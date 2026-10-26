import { describe, it, expect } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { FieldValueSentinel } from '../src/server/testing/field-value-sentinel.js';
import { makeInMemoryFirestore } from '../src/server/testing/in-memory-firestore.js';
import { testAdminApp } from '../src/server/testing/test-admin-app.js';

const BUCKET = 'kit-bucket';
const REFUSED = /ECONNREFUSED 127\.0\.0\.1:9/;

describe('FieldValueSentinel', () => {
  it('is applied by the in-memory Firestore the way the server applies each FieldValue', async () => {
    const store = makeInMemoryFirestore();
    store.seed('counters/a', { n: 2, tags: ['x', 'y'], gone: true });
    await store.db.doc('counters/a').update({
      n: FieldValueSentinel.increment(3),
      tags: FieldValueSentinel.arrayRemove('x'),
      gone: FieldValueSentinel.delete(),
    });
    await store.db.doc('counters/a').update({ tags: FieldValueSentinel.arrayUnion('z', 'y') });
    expect(store.read('counters/a')).toEqual({ n: 5, tags: ['y', 'z'] });
  });

  it('records the serverTimestamp a write asks for, and the store writes the commit time as a Timestamp', async () => {
    const store = makeInMemoryFirestore();
    store.seed('jobs/a', { status: 'open' });
    FieldValueSentinel.serverTimestamp.mockClear();
    const before = Timestamp.now();
    await store.db.doc('jobs/a').update({ closedAt: FieldValueSentinel.serverTimestamp() });
    const snap = await store.db.doc('jobs/a').get();
    const closedAt: unknown = snap.get('closedAt');
    expect(FieldValueSentinel.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(closedAt).toBeInstanceOf(Timestamp);
    expect((closedAt as Timestamp).toMillis()).toBeGreaterThanOrEqual(before.toMillis());
    expect((closedAt as Timestamp).isEqual(snap.updateTime!)).toBe(true);
  });

  it('refuses the FieldValues the store does not apply', () => {
    expect(() => FieldValueSentinel.vector()).toThrow(/not part of the in-memory Firestore fake/);
  });

  it('two sentinels are equal only when kind and operand match', () => {
    expect(FieldValueSentinel.increment(1).isEqual(FieldValueSentinel.increment(1))).toBe(true);
    expect(FieldValueSentinel.increment(1).isEqual(FieldValueSentinel.increment(2))).toBe(false);
  });
});

describe('testAdminApp', () => {
  it('hands out one app for the same options however often it is asked', () => {
    expect(testAdminApp({ storageBucket: BUCKET })).toBe(testAdminApp({ storageBucket: BUCKET }));
  });

  it('refuses a second call that asks for different options', () => {
    testAdminApp({ storageBucket: BUCKET });
    expect(() => testAdminApp()).toThrow(/already runs with storageBucket kit-bucket/);
    expect(() => testAdminApp({ storageBucket: 'other' })).toThrow(/cannot be handed out/);
  });

  it('an Auth call no case spied on is refused by the closed local port', async () => {
    await expect(
      getAuth(testAdminApp({ storageBucket: BUCKET })).getUser('nobody'),
    ).rejects.toThrow(REFUSED);
  });

  it('a Storage call no case spied on is refused by the closed local port without retrying', async () => {
    const bucket = getStorage(testAdminApp({ storageBucket: BUCKET })).bucket();
    await expect(bucket.file('probe.txt').download()).rejects.toThrow(REFUSED);
  });
});
