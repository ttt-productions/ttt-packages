import { describe, expect, it } from 'vitest';
import { isAlreadyExistsError } from '../src/server/already-exists.js';
import { makeInMemoryFirestore } from '../src/server/testing/in-memory-firestore.js';

describe('isAlreadyExistsError', () => {
  it('recognises the refusal a create() gives for a document that already exists', async () => {
    const store = makeInMemoryFirestore();
    store.seed('rows/a', { n: 1 });
    const refusal: unknown = await store.db
      .doc('rows/a')
      .create({ n: 2 })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(isAlreadyExistsError(refusal)).toBe(true);
  });

  it.each([
    ['the numeric gRPC code', Object.assign(new Error('rejected'), { code: 6 })],
    ['the string code', Object.assign(new Error('rejected'), { code: 'already-exists' })],
    ['the message form', new Error('6 ALREADY_EXISTS: Document already exists: rows/a')],
    ['a dashed message', new Error('already-exists')],
  ])('recognises %s', (_label, error) => {
    expect(isAlreadyExistsError(error)).toBe(true);
  });

  it.each([
    ['another gRPC code', Object.assign(new Error('rejected'), { code: 9 })],
    ['another string code', Object.assign(new Error('rejected'), { code: 'not-found' })],
    ['a plain object carrying only the message', { message: 'already exists' }],
    ['nothing', null],
    ['an unrelated error', new Error('deadline exceeded')],
  ])('does not mistake %s for one', (_label, error) => {
    expect(isAlreadyExistsError(error)).toBe(false);
  });
});
