// Fixture-backed UI checks; no production writes or uploads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0, offer, videoFixture, videoUpload;
const pending = new Map(), errors = [];
const user = { id: 'reviewer', fullName: 'Store Reviewer', email: 'reviewer@example.test', emailVerified: true, role: 'BUYER' };
const product = { id: 'product', name: 'Store jacket', price: 90, currency: 'PLN', stockQuantity: 2, category: 'Clothing' };
const pixel = 'https://fixture.example/photo.png';
let shop = { id: 'shop', slug: 'review-shop', name: 'Review shop', ownerId: 'seller', ownerName: 'Seller', ownerPremium: true, city: 'Warsaw', published: true, businessType: 'FASHION', rating: 0, reviewCount: 0, products: [product], highlights: [{ id: 'arrivals', title: 'New arrivals', items: [{ url: pixel, type: 'image' }, { url: pixel, type: 'image' }] }] };
const listing = { id: 'listing', sellerId: 'seller', sellerPremium: true, title: 'Marketplace jacket', price: 140, currency: 'PLN', listingType: 'GOODS', status: 'ACTIVE', mediaUrls: [], locationCity: 'Warsaw', swapEnabled: false };
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
socket.onmessage = async ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = m.params;
  const path = new URL(request.url).pathname;
  let body = [];
  if (path === '/api/v1/auth/me') body = user;
  if (path === '/api/v1/shops') body = [shop];
  if (path === '/api/v1/shops/review-shop' || path === '/api/v1/shops/shop') body = shop;
  if (request.method === 'PATCH' && path === '/api/v1/shops/shop') { shop = { ...shop, ...JSON.parse(request.postData) }; body = shop; }
  if (path === '/api/v1/shops/shop/media') { videoUpload = request; body = { url: 'https://fixture.example/video.webm' }; }
  if (path === '/api/v1/listings') body = [listing, { ...listing, id: 'event', title: 'Community meetup', listingType: 'EVENT', eventStartsAt: '2026-11-12T18:00:00' }];
  if (path === '/api/v1/listings/listing') body = listing;
  if (path === '/api/v1/listings/my') body = [{ ...listing, id: 'mine', sellerId: user.id, title: 'My headphones', price: 40 }];
  if (path.includes('/users/')) body = { ...user, id: 'seller', fullName: 'Seller', premium: true };
  if (path.includes('/relationship')) body = { isFollowing: false, followersCount: 0, followingCount: 0 };
  if (path.includes('/unread-count')) body = { count: 0 };
  if (path === '/api/v1/subscriptions/my') body = { plan: 'ALL_ACCESS', status: 'ACTIVE' };
  if (request.method === 'POST' && path === '/api/v1/swaps') { offer = request.postData; body = { id: 'offer' }; }
  if (request.url === 'https://fixture.example/video.webm' && videoFixture) {
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'video/webm' }], body: videoFixture }); return;
  }
  if (request.url === pixel) {
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==' }); return;
  }
  await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
};
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; };
const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
const has = text => `document.body?.innerText.includes(${JSON.stringify(text)})`;
const click = async text => { await waitFor(has(text)); assert(await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); b?.click(); return !!b})()`)); };
const go = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); };
const input = async (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/v1/*' }, { urlPattern: 'https://fixture.example/*' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.origin==='http://127.0.0.1:5173'){localStorage.clear();localStorage.setItem('hustleup_theme','light');localStorage.setItem('hustleup_token','fixture');localStorage.setItem('hustleup_user',${JSON.stringify(JSON.stringify(user))});}` });
  await mkdir('artifacts/storefront-review', { recursive: true });
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
    await go('/explore/listings'); await waitFor(has('Store jacket')); await waitFor(has('Marketplace jacket'));
    await waitFor(has('Community meetup'));
    assert(await evaluate(`!!document.querySelector('a[href="/shop/review-shop/product/product/checkout"]')`));
    assert(await evaluate(`getComputedStyle(document.querySelector('.discover-page')).backgroundColor === 'rgb(247, 247, 245)'`));
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    assert(await evaluate(`document.querySelector('.discover-sell').getBoundingClientRect().height >= 44 && document.querySelector('.discover-sell').textContent.includes('Add a listing')`));
    assert(await evaluate(`document.querySelectorAll('article [aria-label="Premium member"]').length >= 2`));
    assert(await evaluate(`getComputedStyle(document.querySelector('.listing-card-media')).backgroundColor === 'rgb(244, 244, 241)'`));
    const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`artifacts/storefront-review/explore-light-${width}.png`, Buffer.from(shot.data, 'base64'));
    await go('/shop/review-shop'); await waitFor(has('Store jacket'));
    assert(await evaluate(`Math.abs(document.querySelector('article a').getBoundingClientRect().height / document.querySelector('article a').getBoundingClientRect().width - 1.25) < .05`));
    await click('New arrivals'); await waitFor('!!document.querySelector("dialog[open]")');
    assert(await evaluate(`!document.querySelector('dialog').textContent.includes('Edit collection')`));
    await evaluate(`document.querySelector('[aria-label="Next slide"]').click()`); await waitFor(has('2 / 2'));
    await evaluate(`document.querySelector('[aria-label="Close highlights"]').click()`);
    console.log(`PASS ${width}px: mixed Explore, correct checkout, full-size store cards, light theme and highlight viewer`);
  }
  shop.ownerId = user.id;
  await go('/shop/review-shop'); await waitFor(has('New highlight')); await click('New arrivals'); await click('Edit collection');
  await input('dialog input[maxlength="40"]', 'Autumn offers'); await click('Save highlight'); await waitFor(has('Autumn offers'));
  await go('/shop/review-shop'); await waitFor(has('Autumn offers'));
  console.log('PASS owner highlight editing persists across reload');
  await click('New highlight'); await input('dialog input[maxlength="40"]', 'Behind the scenes');
  await evaluate(`(()=>{const input=document.querySelector('dialog input[type="file"]');const files=new DataTransfer();files.items.add(new File(['fixture'], 'image.png', {type:'image/png'}));files.items.add(new File(['fixture'], 'video.mp4', {type:'video/mp4'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(`document.querySelectorAll('dialog [aria-label^="Remove slide"]').length === 2 && !document.querySelector('dialog input').disabled`);
  await click('Save highlight'); await waitFor(has('Behind the scenes'));
  assert.deepEqual(shop.highlights.at(-1).items.map(i => i.type), ['image', 'video']);
  await click('Behind the scenes'); await click('Edit collection');
  await evaluate('window.confirm=()=>true'); await click('Delete collection'); await waitFor(`!document.querySelector('dialog[open]')`);
  assert.equal(shop.highlights.length, 1);
  console.log('PASS named photo/video collection creation and deletion (mocked uploads)');

  videoFixture = await evaluate(`new Promise(resolve=>{const c=document.createElement('canvas');c.width=160;c.height=120;const ctx=c.getContext('2d');const stream=c.captureStream(10);const r=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];r.ondataavailable=e=>chunks.push(e.data);r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};r.start();let n=0;const timer=setInterval(()=>{ctx.fillStyle=n++%2?'#CDFF00':'#333';ctx.fillRect(0,0,160,120);if(n===12){clearInterval(timer);r.stop();}},100);})`);
  await click('New highlight'); await input('dialog input[maxlength="40"]', 'Video advert');
  await evaluate(`(()=>{const e=document.querySelector('dialog input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(videoFixture)}),c=>c.charCodeAt(0))],'advert.webm',{type:'video/webm'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(`document.querySelectorAll('dialog [aria-label^="Remove slide"]').length === 1 && !document.querySelector('dialog input').disabled`);
  await click('Save highlight'); await waitFor(has('Video advert'));
  assert(/multipart\/form-data;.*boundary=/i.test(videoUpload.headers['Content-Type'] || videoUpload.headers['content-type']));
  await click('Video advert'); await waitFor(`document.querySelector('dialog video')?.readyState >= 2`);
  assert(await evaluate(`document.querySelector('dialog video').controls && document.querySelector('dialog video').playsInline`));
  await evaluate(`document.querySelector('dialog video').dispatchEvent(new Event('error'))`);
  await waitFor(has('This video couldn’t load.')); await click('Retry video');
  await waitFor(`document.querySelector('dialog video')?.readyState >= 2`);
  await evaluate(`document.querySelector('[aria-label="Close highlights"]').click()`);
  shop.ownerPremium = false; listing.sellerPremium = false;
  await go('/explore/listings'); await waitFor(has('Store jacket'));
  assert(await evaluate(`!document.querySelector('article [aria-label="Premium member"]')`));
  console.log('PASS real WebM highlight upload/playback/retry and paid-only premium badges');

  await go('/profile/seller'); await waitFor(`!!document.querySelector('[aria-label="Go back"]')`);
  await evaluate(`document.querySelector('[aria-label="Go back"]').click()`); await waitFor(`location.pathname === '/explore'`);
  await go('/listing/listing'); await click('Offer an item + money'); await waitFor(has('My headphones')); await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.includes('My headphones')).click()`);
  await input('[aria-label="Cash top-up amount"]', '25.50'); await waitFor(has('Your offer at a glance')); await click('Send swap offer');
  await waitFor(`!document.querySelector('[aria-label="Make an item and cash offer"]')`);
  assert(offer?.includes('25.5') && offer.includes('PROPOSER_PAYS') && offer.includes('mine'), 'Submitted item + money payload');
  assert.deepEqual(errors, []);
  console.log('PASS profile back navigation and item + cash offer from existing listing');
} finally { await send('Fetch.disable'); socket.close(); await fetch(`http://127.0.0.1:9222/json/close/${page.id}`); }
