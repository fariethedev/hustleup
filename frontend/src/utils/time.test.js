import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatDateTime, parseServerDate, timeAgo, timeAgoLong } from './time.js';

test('server timestamps with microseconds parse consistently and invalid input fails safely', () => {
  const parsed = parseServerDate('2026-08-26T12:04:37.400303');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), '2026-08-26T12:04:37.400Z');
  assert.equal(parseServerDate('not a date'), null);
  assert.equal(formatDateTime('not a date'), '');
  assert.equal(formatClock('not a date'), '');
});

test('relative ages clamp future timestamps and format long ages by year', () => {
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-01-01T00:00:00Z');
  try {
    assert.equal(timeAgo('2026-01-01T00:00:30Z'), 'now');
    assert.equal(timeAgoLong('2025-12-31T23:00:00Z'), '1h ago');
    assert.equal(timeAgo('2024-01-01T00:00:00Z'), '2y');
    assert.equal(timeAgo('invalid'), '');
  } finally { Date.now = realNow; }
});
