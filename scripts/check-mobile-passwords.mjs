import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const load = async path => import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64'));
const native = await load('../mobile/src/utils/password.js');
const website = await load('../frontend/src/utils/password.js');
const cases = ['', 'Password1!', 'Password1', 'onlylowercase', 'ONLYUPPERCASE', 'abc123456!', 'ABC123456!', 'StrongerSecret42!', 'Longer passphrase 42!', 'abcDEF1234!', 'welcome123!'];
for (const value of cases) {
  assert.equal(native.isValidPassword(value), website.isValidPassword(value));
  assert.equal(native.passwordError(value), website.passwordError(value));
  assert.deepEqual(native.checkRules(value), website.checkRules(value));
}
assert.equal(native.isValidPassword('Password1!'), false);
assert.equal(native.isValidPassword('StrongerSecret42!'), true);
assert.equal(native.MIN_LENGTH, 10);
console.log('PASS native password policy matches website: minimum length, character rules, common-password rejection and validation messages');
