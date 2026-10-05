// Fixture-backed UI checks; no production writes or uploads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0, offer, reportFails=true, postedVideo=false, videoRequest, videoFixture;
let reports=[];
const paid={id:'paid',listingId:'listing',listingTitle:'Purchased headphones',buyerId:'reviewer',sellerId:'seller',role:'buyer',status:'BOOKED',paymentStatus:'PAID',agreedPrice:90,currency:'PLN',createdAt:'2026-10-05T10:00:00',fulfilment:{shippingMethod:'COURIER',fulfilmentStatus:'SHIPPED'}};
const unpaid={...paid,id:'unpaid',listingTitle:'Unpaid purchase',paymentStatus:'PENDING'};
const sale={...paid,id:'sale',listingTitle:'Seller parcel',buyerId:'buyer',sellerId:'reviewer',role:'seller',fulfilment:{shippingMethod:'COURIER',fulfilmentStatus:'CONFIRMED'}};
const requestBooking={...sale,id:'request',status:'INQUIRED',paymentStatus:'PENDING',offeredPrice:65,lastOfferBy:'buyer'};

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
  if(path==='/api/v1/bookings/my') body=[paid,unpaid,sale,requestBooking];
  if(path==='/api/v1/claims/mine') body=reports;
  if(path==='/api/v1/claims' && request.method==='POST'){if(reportFails){status=503;body={error:'Review service unavailable. Retry.'};}else{const payload=JSON.parse(request.postData);reports=[{...payload,id:'claim',status:'OPEN'}];body=reports[0];}}
  if(path==='/api/v1/bookings/sale/fulfilment'){sale.fulfilment={...sale.fulfilment,fulfilmentStatus:JSON.parse(request.postData).status};body=sale;}
  if(path==='/api/v1/feed' && request.method==='POST'){postedVideo=true;videoRequest=request;body={id:'video-post',authorId:'reviewer',authorName:'Store Reviewer',content:'Video upload test',media:[{type:'VIDEO',url:'https://fixture.example/video.webm'}],createdAt:new Date().toISOString()};}
  if(path==='/api/v1/shops/orders/mine')body=[{id:'store-order',productName:'Store purchase',status:'PAID',payoutStatus:'HELD',quantity:1,totalPrice:20,currency:'PLN',fulfilment:{shippingMethod:'COURIER',fulfilmentStatus:'SHIPPED'}}];

  if (path === '/api/v1/auth/me') body = user;
  if (path === '/api/v1/shops') body = [shop];
  if (path === '/api/v1/shops/review-shop' || path === '/api/v1/shops/shop') body = shop;
  if (request.method === 'PATCH' && path === '/api/v1/shops/shop') { shop = { ...shop, ...JSON.parse(request.postData) }; body = shop; }
  if (path === '/api/v1/shops/shop/media') body = { url: pixel };
  if (path === '/api/v1/listings') body = [listing, { ...listing, id: 'event', title: 'Community meetup', listingType: 'EVENT', eventStartsAt: '2026-11-12T18:00:00' }];
  if (path === '/api/v1/listings/listing') body = listing;
  if (path === '/api/v1/listings/my') body = [{ ...listing, id: 'mine', sellerId: user.id, title: 'My headphones', price: 40 }];
  if (path.includes('/users/')) body = { ...user, id: 'seller', fullName: 'Seller' };
  if (path.includes('/relationship')) body = { isFollowing: false, followersCount: 0, followingCount: 0 };
  if (path.includes('/unread-count')) body = { count: 0 };
  if (path === '/api/v1/subscriptions/my') body = { plan: 'VERIFIED', status: 'ACTIVE' };
  if (request.method === 'POST' && path === '/api/v1/swaps') { offer = request.postData; body = { id: 'offer' }; }
  if (request.url === 'https://fixture.example/video.webm' && videoFixture) {
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'video/webm' }], body: videoFixture }); return;
  }
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
 await send('Runtime.enable');await send('Page.enable');
 await send('Fetch.enable',{patterns:[{urlPattern:'*://*/api/v1/*'},{urlPattern:'https://fixture.example/*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin==='http://127.0.0.1:5173'){localStorage.clear();localStorage.setItem('hustleup_theme','light');localStorage.setItem('hustleup_token','fixture');localStorage.setItem('hustleup_user',${JSON.stringify(JSON.stringify(user))});}`});
 await mkdir('artifacts/orders-review',{recursive:true});
 for(const width of [390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  await go('/dashboard?tab=bookings');await waitFor(has('Purchased headphones'));
  assert(await evaluate(`!document.querySelector('article[aria-label="Unpaid purchase"]').innerText.includes('Confirm received')`));
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await click('Review activity');await waitFor(`location.search.includes('view=needsReply')`);
  await waitFor(`!document.querySelector('article[aria-label="Purchased headphones"]')`);
  await waitFor(`document.querySelector('#dashboard-activity').getBoundingClientRect().top<innerHeight`);
  console.log(`PASS ${width}px: review activity chooses actionable orders; no unpaid receipt approval`);
 }
 await go('/dashboard?tab=bookings&view=buying');await waitFor(has('Purchased headphones'));
 await evaluate(`[...document.querySelector('article[aria-label="Purchased headphones"]').querySelectorAll('button')].find(b=>b.textContent.includes('Report a problem')).click()`);
 await waitFor(`!!document.querySelector('[role="dialog"] textarea')`);
 assert(await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Open claim').disabled`));
 await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'The parcel arrived with a broken ear cup.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('Open claim');await waitFor(has('Review service unavailable.'));
 assert(await evaluate(`document.querySelector('textarea').value.includes('broken ear cup')`));
 reportFails=false;await click('Open claim');await waitFor(has('On hold · problem reported'));
 assert(await evaluate(`!document.querySelector('article[aria-label="Purchased headphones"]').innerText.includes('Confirm received')`));
 console.log('PASS report validation, failure preserves text, successful report disables receipt approval');
 await go('/dashboard?tab=orders');await waitFor(has('Store purchase'));await waitFor(has('Report a problem'));await waitFor(has('Confirm received'));
 console.log('PASS storefront buyers have receipt and problem-report controls');
 await go('/dashboard?tab=bookings&view=selling');await waitFor(has('Seller parcel'));
 await evaluate(`[...document.querySelector('article[aria-label="Seller parcel"]').querySelectorAll('button')].find(b=>b.textContent.trim()==='Delivery').click()`);
 await waitFor(has('Where is it now?'));await click('Being prepared');await click('Save & notify');await waitFor(`!document.body.innerText.includes('Where is it now?')`);
 assert.equal(sale.fulfilment.fulfilmentStatus,'PREPARING');
 await evaluate(`document.querySelector('article[aria-label="Seller parcel"]').scrollIntoView()`);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/orders-review/orders.png',Buffer.from(shot.data,'base64'));
 console.log('PASS seller icon-based shipping update');
 await go('/feed');await waitFor(`!!document.querySelector('input[type="file"][multiple]')`);
 videoFixture = await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const ctx=canvas.getContext('2d');const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};recorder.start();let n=0;const timer=setInterval(()=>{ctx.fillStyle=n++%2?'#CDFF00':'#333';ctx.fillRect(0,0,160,120);if(n===12){clearInterval(timer);recorder.stop();}},100);})`);
 await evaluate(`(()=>{const e=document.querySelector('input[type="file"][multiple]');const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(videoFixture)}),c=>c.charCodeAt(0))],'clip.webm',{type:'video/webm'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(has('1/15'));await click('Post');await waitFor(has('Video upload test'));
 assert(postedVideo);assert(/multipart\/form-data;.*boundary=/i.test(videoRequest.headers['Content-Type']||videoRequest.headers['content-type']));
 await waitFor(`document.querySelector('video[src="https://fixture.example/video.webm"]')?.readyState>=2`);
 console.log('PASS feed accepts a real WebM attachment, sends multipart boundary, and decodes the returned video');
 assert.deepEqual(errors,[]);
}finally{await send('Fetch.disable');socket.close();await fetch(`http://127.0.0.1:9222/json/close/${page.id}`);}
