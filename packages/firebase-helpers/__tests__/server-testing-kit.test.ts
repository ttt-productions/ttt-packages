import { describe, it, expect } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { FieldValueSentinel } from '../src/server/testing/field-value-sentinel.js';
import { makeInMemoryFirestore } from '../src/server/testing/in-memory-firestore.js';
import { testAdminApp } from '../src/server/testing/test-admin-app.js';

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

  it('records each FieldValue call, so a case can assert the write asked for one', () => {
    FieldValueSentinel.serverTimestamp.mockClear();
    FieldValueSentinel.serverTimestamp();
    expect(FieldValueSentinel.serverTimestamp).toHaveBeenCalledTimes(1);
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
  it('hands out one app however often it is asked', () => {
    expect(testAdminApp()).toBe(testAdminApp());
  });

  it('an Auth call no case spied on fails at once instead of reaching Google', async () => {
    await expect(getAuth(testAdminApp()).getUser('nobody')).rejects.toThrow();
  });
});
