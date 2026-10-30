import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addReading, BLOCK_UNITS, compactToken, economySchema, formatInteger, formatToken, measurementState, percentOf, relativeTime, statusSchema, type Measurement } from '../src/api.ts';

const now = Date.parse('2026-10-30T19:30:00Z');
const measurement: Measurement = { freshness: 'online', observedAt: new Date(now - 5000).toISOString(), staleAfterSeconds: 120, counterEpoch: 'test-epoch', provenance: 'hardware', coreStatus: 'IDLE', rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 0 };

test('token formatting preserves values above Number precision and truncates fractional units', () => {
  assert.equal(formatToken('16455437093891105632782688', 18), '16,455,437.09');
  assert.equal(formatToken('2100000000000000000000000000', 18, 0), '2,100,000,000');
  assert.equal(formatToken('999999999999999999', 18), '0.99');
  assert.equal(formatToken('1', 18), '0.00');
  assert.equal(formatToken('123', 0), '123.00');
  assert.equal(formatInteger('9007199254740993'), '9,007,199,254,740,993');
  assert.equal(formatInteger(null), '–');
});

test('compact units and cap fractions use exact integer operations', () => {
  assert.equal(compactToken('16455437093891105632782688', 18), '16.45M');
  assert.equal(compactToken('2100000000000000000000000000', 18), '2.10B');
  assert.equal(percentOf('35822082', BLOCK_UNITS), 3.5822);
  assert.equal(percentOf('16455437093891105632782688', '2100000000000000000000000000'), 0.7835);
  assert.equal(percentOf('1', '0'), null);
});

test('wheel distinguishes fresh idle, running, stale, faults and missing measurements', () => {
  assert.equal(measurementState(measurement, now).label, 'Resting');
  assert.equal(measurementState({ ...measurement, rpmMilli: 2500 }, now).label, 'Running');
  assert.equal(measurementState({ ...measurement, coreStatus: 'ACTIVE' }, now).active, true);
  assert.equal(measurementState({ ...measurement, coreStatus: 'COUNTER_FAULT' }, now).label, 'Counter fault');
  assert.equal(measurementState(measurement, now + 121000).label, 'Stale reading');
  assert.equal(measurementState({ ...measurement, freshness: 'stale' }, now).label, 'Stale reading');
  assert.equal(measurementState(measurement, now, true).active, false);
  assert.equal(measurementState(null, now).label, 'No reading');
  assert.equal(measurementState({ ...measurement, coreStatus: 'NEW_UNKNOWN_STATE' }, now).label, 'Unknown state');
});

test('activity uses source observations, deduplicates, excludes stale and future data', () => {
  const first = addReading([], measurement, now);
  assert.equal(first.length, 1);
  assert.equal(addReading(first, measurement, now).length, 1);
  assert.equal(addReading(first, { ...measurement, freshness: 'stale' }, now).length, 1);
  assert.equal(addReading([], { ...measurement, observedAt: new Date(now + 60000).toISOString() }, now).length, 0);
  const second = addReading(first, { ...measurement, observedAt: new Date(now).toISOString(), rpmMilli: 12345, distanceMm: 12000 }, now);
  assert.equal(second[1].rpm, 12.345);
  assert.equal(second[1].distance, 12);
  const expired = [{ time: now - 3_700_000, rpm: 1, distance: 1, epoch: 'old' }];
  assert.equal(addReading(expired, measurement, now).length, 1);
});

test('endpoint schemas reject bad amounts and block units and accept unavailable services', () => {
  assert.equal(statusSchema.safeParse({ schemaVersion: 1, generatedAt: new Date(now).toISOString(), measurement: null, builder: { status: 'unavailable', reason: 'no_measurement' }, settlementQueue: { status: 'unavailable' } }).success, true);
  assert.equal(statusSchema.safeParse({ schemaVersion: 1, generatedAt: new Date(now).toISOString(), measurement: { ...measurement, rpmMilli: -1 } }).success, false);
  assert.equal(statusSchema.safeParse({ schemaVersion: 1, generatedAt: 'not a date', measurement }).success, false);
  assert.equal(statusSchema.safeParse({ schemaVersion: 1, generatedAt: new Date(now).toISOString(), builder: { status: 'available', projected: { blockHeight: '5', blockProgress: '1000000000', cumulativeWork: '1', workPerThousandBlocks: '1000' } } }).success, false);
  assert.equal(economySchema.safeParse({ status: 'unavailable', reason: 'indexer_unavailable' }).success, true);
  assert.equal(economySchema.safeParse({ status: 'available', supply: { capBaseUnits: 'invalid' } }).success, false);
});

test('relative times do not mistake missing values for fresh observations', () => {
  assert.equal(relativeTime(null, now), 'Not received');
  assert.equal(relativeTime(now, now), 'just now');
  assert.equal(relativeTime(now - 15000, now), '15s ago');
  assert.equal(relativeTime(now - 120000, now), '2m ago');
});
