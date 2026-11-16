import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LENGTH, checkRules, isCommonPassword, isValidPassword, passwordError, passwordStrength } from './password.js';

test('password validation reports each missing requirement and accepts a compliant value', () => {
  assert.equal(MIN_LENGTH, 10);
  assert.deepEqual(checkRules('Abc123!'), { length: false, lower: true, upper: true, digit: true, symbol: true });
  assert.match(passwordError('Abc123!'), /at least 10 characters/);
  assert.equal(isValidPassword('Winter!2026safe'), true);
  assert.equal(passwordError('Winter!2026safe'), null);
});

test('obvious passwords are rejected case insensitively and strength stays capped', () => {
  assert.equal(isCommonPassword('  PASSWORD1! '), true);
  assert.equal(isValidPassword('Password1!'), false);
  assert.equal(passwordStrength('Password1!').label, 'Too common');
  assert.equal(passwordError('Password1!'), 'That password is too common — pick something less guessable.');
});

test('strength distinguishes valid passwords by length and handles empty input', () => {
  assert.equal(passwordStrength('').score, 0);
  assert.equal(passwordStrength('Summer!2026').tone, 'good');
  assert.equal(passwordStrength('Summer!2026LongX').tone, 'excellent');
});
