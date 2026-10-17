import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { arrayElement, compositeMembers, kindOf, knownKeys, objectShape, unwrap } from '../../src/zod-shape/index.js';

describe('zod-shape', () => {
  const Inner = z.object({ a: z.string(), b: z.number().optional() });

  it('names a schema by its lowercase kind', () => {
    expect(kindOf(Inner)).toBe('object');
    expect(kindOf(z.array(z.string()))).toBe('array');
    expect(kindOf({})).toBeNull();
  });

  it('sees through optional, nullable, default, readonly, and transform wrappers', () => {
    const wrapped = Inner.nullable().optional().default({ a: 'x' }).readonly().transform((value) => value);
    expect(kindOf(unwrap(wrapped))).toBe('object');
    expect(knownKeys(wrapped)).toEqual(new Set(['a', 'b']));
  });

  it("never reads a preprocess's inner shape as the stored keys — the value is rewritten before it applies", () => {
    expect(knownKeys(z.preprocess((value) => value, Inner))).toBeNull();
  });

  it('reads an object shape and an array element, and nothing for other kinds', () => {
    expect(Object.keys(objectShape(Inner))).toEqual(['a', 'b']);
    expect(objectShape(z.string())).toBeNull();
    expect(kindOf(arrayElement(z.array(Inner)))).toBe('object');
    expect(arrayElement(Inner)).toBeNull();
  });

  it("lists a composite's members: union options, intersection sides, a record's values, tuple items", () => {
    const A = z.object({ kind: z.literal('a') });
    const B = z.object({ kind: z.literal('b') });
    expect(compositeMembers(z.union([A, B]))).toEqual([A, B]);
    expect(compositeMembers(z.discriminatedUnion('kind', [A, B]))).toEqual([A, B]);
    expect(compositeMembers(z.intersection(A, B))).toEqual([A, B]);
    expect(compositeMembers(z.record(z.string(), A))).toEqual([A]);
    expect(compositeMembers(z.tuple([A, B]))).toEqual([A, B]);
    expect(compositeMembers(Inner)).toBeNull();
  });
});
