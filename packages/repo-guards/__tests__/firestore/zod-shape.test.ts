import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  arrayElement,
  compositeMembers,
  kindOf,
  knownKeys,
  objectMode,
  objectShape,
  reachedObjects,
  unknownFieldPaths,
  unwrap,
} from '../../src/zod-shape/zod-shape.js';

describe('zod-shape', () => {
  const Inner = z.object({ a: z.string(), b: z.number().optional() });

  it('names a schema by its lowercase kind', () => {
    expect(kindOf(Inner)).toBe('object');
    expect(kindOf(z.array(z.string()))).toBe('array');
    expect(kindOf({})).toBeNull();
  });

  it('sees through optional, nullable, default, readonly, and transform wrappers', () => {
    const wrapped = Inner.nullable()
      .optional()
      .default({ a: 'x' })
      .readonly()
      .transform((value) => value);
    expect(kindOf(unwrap(wrapped))).toBe('object');
    expect(knownKeys(wrapped)).toEqual(new Set(['a', 'b']));
  });

  it("never reads a preprocess's inner shape as the stored keys — the value is rewritten before it applies", () => {
    expect(knownKeys(z.preprocess((value) => value, Inner))).toBeNull();
  });

  it('reads an object shape and an array element, and nothing for other kinds', () => {
    expect(Object.keys(objectShape(Inner) ?? {})).toEqual(['a', 'b']);
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

describe('zod-shape object modes and reached objects', () => {
  it('names an object plain, strict, loose, or catchall, and nothing else an object mode', () => {
    expect(objectMode(z.object({ a: z.string() }))).toBe('plain');
    expect(objectMode(z.object({ a: z.string() }).strict())).toBe('strict');
    expect(objectMode(z.strictObject({ a: z.string() }))).toBe('strict');
    expect(objectMode(z.object({ a: z.string() }).passthrough())).toBe('loose');
    expect(objectMode(z.looseObject({ a: z.string() }))).toBe('loose');
    expect(objectMode(z.object({ a: z.string() }).catchall(z.number()))).toBe('catchall');
    expect(objectMode(z.string())).toBeNull();
  });

  it('reaches objects through fields, arrays, records, unions, intersections, tuples, pipes, lazy, and wrappers', () => {
    const Deep = z.strictObject({ d: z.string() });
    const schema = z.object({
      list: z.array(z.object({ inList: z.strictObject({ x: z.number() }) })),
      map: z.record(z.string(), z.strictObject({ y: z.number() })),
      either: z.union([z.object({ k: z.literal('a') }), z.strictObject({ k: z.literal('b') })]),
      both: z.intersection(z.object({ l: z.string() }), z.strictObject({ r: z.string() })),
      pair: z.tuple([z.string(), z.strictObject({ t: z.string() })]),
      piped: z.preprocess((value) => value, z.strictObject({ p: z.string() })),
      lazy: z
        .lazy(() => Deep)
        .optional()
        .nullable(),
      refined: z.strictObject({ q: z.string() }).refine(() => true),
    });
    const strict = reachedObjects(schema, 'docs/{id}')
      .filter((object) => object.mode === 'strict')
      .map((object) => object.path);
    expect(strict.sort()).toEqual(
      [
        'docs/{id}.list[].inList',
        'docs/{id}.map.*',
        'docs/{id}.either|1',
        'docs/{id}.both|1',
        'docs/{id}.pair|1',
        'docs/{id}.piped',
        'docs/{id}.lazy',
        'docs/{id}.refined',
      ].sort(),
    );
  });

  it('reaches a shared object once, at its first path', () => {
    const Shared = z.strictObject({ s: z.string() });
    const reached = reachedObjects(z.object({ a: Shared, b: Shared }));
    expect(
      reached.filter((object) => object.schema === Shared).map((object) => object.path),
    ).toEqual(['.a']);
  });
});

describe('zod-shape unknown field paths', () => {
  it('lists every undeclared field at any depth, through arrays, records, and the union member that parses', () => {
    const schema = z.object({
      a: z.object({ b: z.string() }),
      list: z.array(z.object({ c: z.number() })),
      map: z.record(z.string(), z.object({ d: z.number() })),
      either: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('x'), x: z.number() }),
        z.object({ kind: z.literal('y'), y: z.number() }),
      ]),
    });
    expect(
      unknownFieldPaths(schema, {
        a: { b: 's', stale: 1 },
        list: [{ c: 1 }, { c: 2, gone: true }],
        map: { k: { d: 1, old: 0 } },
        either: { kind: 'y', y: 1, x: 2 },
        top: 'left behind',
      }),
    ).toEqual(['.a.stale', '.list[1].gone', '.map.k.old', '.either.x', '.top']);
  });

  it('lists nothing for a value that holds only declared fields', () => {
    expect(
      unknownFieldPaths(z.object({ a: z.object({ b: z.string() }).optional() }), { a: { b: 's' } }),
    ).toEqual([]);
  });
});
