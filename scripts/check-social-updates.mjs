// Fixture-backed UI checks; no production writes or uploads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0, offer, failSwipe = true;
let requests = [{id:'follower',fullName:'New Follower'}];
let agreement = {id:'agreement',listingId:'listing',listingTitle:'Marketplace jacket',buyerId:'reviewer',sellerId:'seller',status:'NEGOTIATING',counterPrice:120,currency:'PLN',lastOfferBy:'seller',version:1,negotiationHistory:[]};
const pending = new Map(), errors = [];
const user = { id: 'reviewer', fullName: 'Store Reviewer', email: 'reviewer@example.test', emailVerified: true, role: 'BUYER' };
const product = { id: 'product', name: 'Store jacket', price: 90, currency: 'PLN', stockQuantity: 2, category: 'Clothing' };
const pixel = 'https://fixture.example/photo.png';
let shop = { id: 'shop', slug: 'review-shop', name: 'Review shop', ownerId: 'seller', ownerName: 'Seller', city: 'Warsaw', published: true, businessType: 'FASHION', rating: 0, reviewCount: 0, products: [product], highlights: [{ id: 'arrivals', title: 'New arrivals', items: [{ url: pixel, type: 'image' }, { url: pixel, type: 'image' }] }] };
const listing = { id: 'listing', sellerId: 'seller', title: 'Marketplace jacket', price: 140, currency: 'PLN', listingType: 'GOODS', status: 'ACTIVE', mediaUrls: [], locationCity: 'Warsaw', swapEnabled: false };
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
socket.onmessage = async ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = m.params;
  const path = new URL(request.url).pathname;
  let body = [], status = 200;
  if(path==='/api/v1/jobs') body={content:[{id:'job',title:'Product designer',companyName:'Studio North',salaryMin:9000,salaryCurrency:'PLN',remote:true}]};
  if(path==='/api/v1/news') body={content:[{id:'article',title:'Building a better neighbourhood',summary:'Ideas from the local community',authorName:'Editorial team',category:'community'}]};
  if(path==='/api/v1/news/article') body={id:'article',title:'Building a better neighbourhood',body:'Full article content'};
  if(path==='/api/v1/dating/profile/me') body={id:user.id,fullName:'Reviewer',age:25,imageUrl:pixel};
  if(path==='/api/v1/dating/profiles') body=[{id:'alex',fullName:'Alex',age:26,bio:'Weekend coffee and new adventures',imageUrl:pixel,interests:'Coffee,Travel'},{id:'sam',fullName:'Sam',age:28,imageUrl:pixel}];
  if(path.startsWith('/api/v1/dating/pass/')) {status=failSwipe?500:200;body={};}
  if(path==='/api/v1/follows/requests') body=requests;
  if(path==='/api/v1/follows/requests/follower/accept') {requests=[];body={status:'accepted'};}
  if(path==='/api/v1/direct-messages/partners') body=[{id:'seller',fullName:'Seller',negotiating:true,lastMessage:'Offer',unreadCount:1}];
  if(path==='/api/v1/direct-messages/seller') body=[{id:'message',senderId:'seller',recipientId:user.id,messageType:'OFFER',offerBookingId:'agreement',createdAt:new Date().toISOString()}];
  if(path==='/api/v1/bookings/agreement') body=agreement;
  if(path==='/api/v1/bookings/agreement/counter') {const payload=JSON.parse(request.postData);agreement={...agreement,counterPrice:payload.counterPrice,lastOfferBy:user.id,version:2};body=agreement;}
  if(path==='/api/v1/bookings/agreement/accept') {agreement={...agreement,status:'BOOKED',agreedPrice:120,paymentStatus:'PENDING',version:2};body=agreement;}
  if (path === '/api/v1/auth/me') body = user;
  if (path === '/api/v1/shops') body = [shop];
  if (path === '/api/v1/shops/review-shop' || path === '/api/v1/shops/shop') body = shop;
  if (request.method === 'PATCH' && path === '/api/v1/shops/shop') { shop = { ...shop, ...JSON.parse(request.postData) }; body = shop; }
  if (path === '/api/v1/shops/shop/media') body = { url: pixel };
  if (path === '/api/v1/listings') body = [listing];
  if (path === '/api/v1/listings/listing') body = listing;
  if (path === '/api/v1/listings/my') body = [{ ...listing, id: 'mine', sellerId: user.id, title: 'My headphones', price: 40 }];
  if (path.includes('/users/')) body = { ...user, id: 'seller', fullName: 'Seller' };
  if (path.includes('/relationship')) body = { isFollowing: false, followersCount: 0, followingCount: 0 };
  if (path.includes('/unread-count')) body = { count: 0 };
  if (path === '/api/v1/subscriptions/my') body = { plan: 'VERIFIED', status: 'ACTIVE' };
  if (request.method === 'POST' && path === '/api/v1/swaps') { offer = request.postData; body = { id: 'offer' }; }
  if (request.url === pixel) {
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==' }); return;
  }
  await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
};
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; };
const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
const has = text => `document.body?.innerText.includes(${JSON.stringify(text)})`;
const click = async text => { await waitFor(has(text)); assert(await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); b?.click(); return !!b})()`)); };
const go = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); };
const input = async (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Fetch.enable', {patterns:[{urlPattern:'*://*/api/v1/*'},{urlPattern:'https://fixture.example/*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument', {source:`if(location.origin==='http://127.0.0.1:5173'){localStorage.setItem('hustleup_theme','light');localStorage.setItem('hustleup_token','fixture');localStorage.setItem('hustleup_user',${JSON.stringify(JSON.stringify(user))});}`});
  await mkdir('artifacts/social-review',{recursive:true});
  for(const width of [390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});
    for(const [path,title] of [['/jobs','Product designer'],['/news','Building a better neighbourhood']]){
      await go(path);await waitFor(has(title));
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`artifacts/social-review/${path.slice(1)}-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    console.log(`PASS ${width}px: jobs and news content, responsive layout`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await go('/settings?tab=privacy'); await waitFor(has('New Follower'));await click('Approve');await waitFor(has('No pending requests.'));
  console.log('PASS private-account follow approval');
  await go('/dating');await waitFor(has('Alex'));
  await evaluate(`document.querySelector('[aria-label="Nope"]').click()`);
  await waitFor(has('Swipe was not saved.'));
  assert(await evaluate(has('Alex')),'Failed swipe retains profile');
  failSwipe=false;
  await evaluate(`document.querySelector('[aria-label="Nope"]').click()`);
  await waitFor(`!document.body.innerText.includes('Alex') && document.body.innerText.includes('Sam')`);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/social-review/bond-mobile.png',Buffer.from(shot.data,'base64'));
  console.log('PASS Bond failed-swipe recovery and saved swipe advancement');
  await go('/dm/seller'); await waitFor(has('Accept price'));await click('Accept price');await waitFor(has('DEAL AGREED'));
  await click('Continue to payment');await waitFor(`location.pathname === '/checkout'`);
  assert(agreement.status==='BOOKED');
  console.log('PASS chat agreement leads to checkout');
  assert.deepEqual(errors,[]);
} finally { await send('Fetch.disable');socket.close();await fetch(`http://127.0.0.1:9222/json/close/${page.id}`); }
