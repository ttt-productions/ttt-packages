import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// An error this package throws can escape to monitoring, and an object key or bucket
// must not travel with it: keys and buckets ride error PROPERTIES, never message text.
// This catches the direct shape — an error constructor or `super(` call whose arguments
// interpolate something named for a key, bucket, or path.

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function listSource(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : listSource(full);
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : [];
  });
}

/** Every error construction in `source` whose arguments interpolate a key, bucket, or path. */
function keyedErrorConstructions(source: string): string[] {
  const found: string[] = [];
  const start = /\b(?:new\s+\w*Error|super)\s*\(/g;
  for (let match = start.exec(source); match; match = start.exec(source)) {
    let depth = 1;
    let end = start.lastIndex;
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')') depth--;
    }
    if (/\$\{[^}]*(?:key|bucket|path)/i.test(source.slice(start.lastIndex, end))) {
      found.push(source.slice(match.index, end));
    }
  }
  return found;
}

describe('media-processing-core error messages carry no object key', () => {
  it.each([
    ['a plain Error', 'throw new Error(`R2 delete failed for ${key}: ${res.status}`);'],
    ['an AggregateError message argument', 'throw new AggregateError(\n  [a, b],\n  `Copy to ${toKey}: failed`,\n  { cause: b },\n);'],
    ['a super() message', 'super(\n  `R2 ${params.operation} failed for ${params.bucket}/${params.key}`.trim(),\n  undefined,\n);'],
    ['a storage path', 'throw new UploadError(`missing ${storagePath}`);'],
  ])('flags %s', (_label, snippet) => {
    expect(keyedErrorConstructions(snippet)).toHaveLength(1);
  });

  it('passes a message built from non-key values', () => {
    expect(keyedErrorConstructions('super(`source exceeded the ${maxBytes}-byte limit`);')).toEqual([]);
  });

  it('finds no such construction in package source', () => {
    const violations = listSource(SRC).flatMap((file) =>
      keyedErrorConstructions(readFileSync(file, 'utf8')).map(
        (construction) => `${relative(SRC, file).split(sep).join('/')}: ${construction}`,
      ),
    );
    expect(violations, 'carry the key/bucket as an error property instead').toEqual([]);
  });
});
