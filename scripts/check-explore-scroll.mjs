// Requires Vite on 5173 and Chrome with remote debugging on 9222.
import assert from 'node:assert/strict';

const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.onmessage = async ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const p = pending.get(message.id); pending.delete(message.id);
    return message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const path = new URL(request.url).pathname;
  let body = [];
  if (path.includes('/listings')) body = Array.from({ length: 30 }, (_, i) => ({
    id: `scroll-${i}`, title: `Explore listing ${i}`, price: 20, currency: 'PLN', listingType: 'GOODS', status: 'ACTIVE', sellerName: 'Test seller', locationCity: 'Warsaw',
  }));
  if (path.includes('/shops')) body = [{ id: 'shop-test', slug: 'shop-test', name: 'Test shop' }];
  await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
};
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/v1/*' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'if(location.origin === "http://127.0.0.1:5173")localStorage.clear();' });
  for (const [width, height] of [[360, 640], [390, 844], [1440, 900]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    for (const route of ['/explore', '/explore/listings']) {
      await send('Page.navigate', { url: 'http://127.0.0.1:5173' + route });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('!!document.querySelector(".discover-grid article")')) break;
        await new Promise(r => setTimeout(r, 100));
      }
      assert(await evaluate('!!document.querySelector(".discover-grid article")'), 'Listings render');
      assert(await evaluate('document.querySelector(".discover-grid article").getBoundingClientRect().top < innerHeight - 100'), 'Listings visible on arrival');
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'No horizontal overflow');
      await evaluate('window.scrollTo(0, 550); new Promise(r => setTimeout(r, 100))');
      assert(await evaluate('document.querySelector(".discover-toolbar").getBoundingClientRect().bottom < 0'), 'Search scrolls away instead of covering listings');
      assert(await evaluate('!!document.elementFromPoint(innerWidth / 4, innerHeight / 2)?.closest(".discover-grid")'), 'Listings remain unobstructed');
      console.log(`PASS ${route} at ${width}x${height}`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await send('Fetch.disable'); socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${page.id}`);
}
