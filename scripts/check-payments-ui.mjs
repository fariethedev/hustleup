// Fixture-backed browser checks. Start Vite on 5173 and headless Chrome on 9222.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const targets = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
const page = targets.find(t => t.type === 'page');
assert(page);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const pending = new Map();
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const errors = [], calls = [];
let subscription = { plan: 'FREE' };
let payout = { connected: false, payoutsEnabled: false, detailsSubmitted: false, chargesEnabled: false, platformFeePercent: 8 };
let statusError = false, plansError = false;
const user = { id: 'payment-review', role: 'BUYER', fullName: 'Payment Review', email: 'review@example.test', emailVerified: true };
socket.onmessage = async event => {
  const message = JSON.parse(event.data);
  if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p?.reject(new Error(message.error.message)) : p?.resolve(message.result); return; }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const route = new URL(request.url).pathname.replace('/api/v1', '');
  calls.push(request.method + ' ' + route);
  let data = [], responseCode = 200;
  if (route === '/auth/me') data = user;
  if (route === '/subscriptions/my') data = subscription;
  if (route === '/subscriptions/plans') {
    data = { currency: 'PLN', plans: [{ id: 'MONTHLY', price: 9, months: 1 }, { id: 'ALL_ACCESS', price: 20, months: 1 }] };
    if (plansError) { responseCode = 502; data = { error: 'Unavailable' }; }
  }
  if (route === '/payouts/status') { data = payout; if (statusError) { responseCode = 502; data = { error: 'Could not verify your bank connection with Stripe. Please retry.' }; } }
  if (route === '/payouts/connect' || route === '/payouts/dashboard') { responseCode = 502; data = { error: 'Fixture: Stripe temporarily unavailable. Retry safely.' }; }
  if (route === '/subscriptions/checkout') { responseCode = 502; data = { error: 'Fixture: checkout unavailable.' }; }
  if (route === '/notifications/unread-count') data = { count: 0 };
  await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(data)).toString('base64') });
};
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async expression => { for(let i=0;i<100;i++){ if(await evaluate(expression))return; await sleep(100); } throw new Error('Timeout: '+expression); };
const go = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173'+path }); await waitFor('!!document.querySelector("main")'); };
const has = text => 'document.body.innerText.includes('+JSON.stringify(text)+')';
const click = async text => { assert(await evaluate('(()=>{const b=[...document.querySelectorAll("button,a")].find(b=>b.textContent.trim()==='+JSON.stringify(text)+'); if(!b)return false;b.click();return true})()')); };
const fit = async () => assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'No horizontal overflow');
const shot = async name => { const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('artifacts/payments-review/'+name+'.png',Buffer.from(r.data,'base64')); };
try {
  await mkdir('artifacts/payments-review',{recursive:true});
  await send('Runtime.enable'); await send('Page.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*://*/api/v1/*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("hustleup_token","fixture-only");localStorage.setItem("hustleup_user",'+JSON.stringify(JSON.stringify(user))+');'});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await go('/plans'); await waitFor(has('Choose All Access')); await fit(); await shot('plans-mobile');
  assert(await evaluate('document.querySelectorAll("article").length === 3'));
  await click('Choose Plus'); await waitFor(has('Fixture: checkout unavailable.'));
  await go('/payouts'); await waitFor(has('No bank account connected yet.')); await fit(); await shot('payments-setup-mobile');
  await click('Connect bank account'); await waitFor(has('Fixture: Stripe temporarily unavailable.'));
  payout = {...payout, connected:true, detailsSubmitted:true};
  await go('/payouts?payout=return'); await waitFor(has('Details submitted.')); await fit(); await shot('payments-verification-mobile');
  await click('Manage bank & view payouts'); await waitFor(has('Fixture: Stripe temporarily unavailable.'));
  assert(calls.includes('POST /payouts/dashboard'));
  payout.payoutsEnabled=true;
  await go('/payouts'); await waitFor(has('Stripe has enabled payouts.')); await fit(); await shot('payments-ready-mobile');
  await waitFor(has('Marketplace fee: 8%'));
  payout.transfersEnabled=false; payout.requirementsDue=['individual.verification.document'];
  await go('/payouts'); await waitFor(has('Receiving marketplace transfers is not enabled yet.')); await waitFor(has('Action needed:'));
  payout.transfersEnabled=true; payout.requirementsDue=[];
  statusError=true;
  await go('/payouts'); await waitFor(has('Could not verify your bank connection')); assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Connect bank")).disabled'));
  statusError=false; await click('Refresh status'); await waitFor(has('Stripe has enabled payouts.'));
  subscription={plan:'PLUS',status:'ACTIVE'};
  await go('/leaderboard'); await waitFor(has('Leaderboards come with All Access')); await waitFor(has('Extend Plus')); await fit();
  plansError=true; await go('/plans'); await waitFor(has('We could not load your plans'));
  plansError=false; await click('Retry'); await waitFor(has('Extend Plus'));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('/plans'); await waitFor(has('Extend Plus')); await fit(); await shot('plans-desktop');
  await go('/payouts'); await waitFor(has('Stripe has enabled payouts.')); await fit(); await shot('payments-desktop');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: 3 tiers; Plus gating; checkout error; bank setup, return, pending, enabled and unavailable states; recovery; dashboard action; mobile and desktop overflow.');
  console.log('Fixtures only: no payment, bank account or Stripe account was created.');
} finally { await send('Fetch.disable'); socket.close(); }
