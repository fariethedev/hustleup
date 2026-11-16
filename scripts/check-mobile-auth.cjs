// Exercise the real auth reducer/thunks with an in-memory API and storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const requireMobile = createRequire(require('node:path').resolve('mobile/package.json'));
const ts = requireMobile('typescript');
const { configureStore } = requireMobile('@reduxjs/toolkit');
const saved = new Map();
let response;
const api = { register: async () => ({ data: response }), me: async () => ({ data: { id: 'test-user', email: 'test@example.test' } }) };
const storage = { setItem: async (key, value) => { assert.equal(typeof value, 'string'); saved.set(key, value); } };
const code = ts.transpileModule(fs.readFileSync('mobile/src/store/authSlice.js', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const output = {};
vm.runInNewContext(code, { exports: output, require: name => name.includes('async-storage') ? storage : name === '../api/client' ? { authApi: api, usersApi: {} } : requireMobile(name) });
(async () => {
  const store = configureStore({ reducer: { auth: output.default } });
  response = { verificationRequired: true, email: 'test@example.test' };
  await store.dispatch(output.registerUser({ email: response.email }));
  assert.equal(store.getState().auth.isAuthenticated, false);
  assert.equal(saved.size, 0, 'Unverified registration must not store tokens');
  response = { accessToken: 'test-token' };
  await store.dispatch(output.registerUser({ email: 'test@example.test' }));
  assert.equal(store.getState().auth.isAuthenticated, true);
  assert.equal(saved.get('hustleup_token'), 'test-token');
  assert.equal(saved.has('hustleup_refresh'), false);
  console.log('PASS: verification-required registration stays signed out; token-bearing registration persists a session without requiring an optional refresh token.');
})().catch(error => { console.error(error); process.exitCode = 1; });
