import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// file-input's components are rendered inside consumers' forms, and ui-core's Button
// passes no `type`, so an untyped one is a submit button there (FRONTEND-203). Every
// Button this package renders states its type, or renders through `asChild`.

const COMPONENTS_DIR = join(__dirname, '..', 'src', 'react', 'components');

/** Every `<Button …>` opening tag in a source string (JSX braces and quotes respected). */
function buttonOpeningTags(source: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('<Button', from);
    if (start < 0) return tags;
    if (!/[\s>]/.test(source[start + '<Button'.length] ?? '')) {
      from = start + 1;
      continue;
    }
    let depth = 0;
    let quote: string | null = null;
    let end = start + '<Button'.length;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (depth === 0 && (ch === '"' || ch === "'")) quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    tags.push(source.slice(start, end + 1));
    from = end + 1;
  }
}

describe('file-input Button type guard', () => {
  it('finds Button tags to check', () => {
    const total = readdirSync(COMPONENTS_DIR)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => buttonOpeningTags(readFileSync(join(COMPONENTS_DIR, f), 'utf8')));
    expect(total.length).toBeGreaterThan(0);
  });

  it('every Button a file-input component renders states its type or renders asChild', () => {
    const untyped = readdirSync(COMPONENTS_DIR)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) =>
        buttonOpeningTags(readFileSync(join(COMPONENTS_DIR, f), 'utf8'))
          .filter((tag) => !/\btype=/.test(tag) && !/\basChild\b/.test(tag))
          .map((tag) => `${f}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`),
      );
    expect(untyped).toEqual([]);
  });
});
