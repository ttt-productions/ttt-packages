import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// FRONTEND-204's motion tokens are one theme-invariant family owned here: all four resolve from
// `contract.css`'s :root (the first stylesheet theme-core loads), and no theme block restates them.
const STYLES = path.resolve(__dirname, '../src/styles');
const MOTION_TOKENS = ['--motion-fast', '--motion-base', '--motion-slow', '--motion-ease'] as const;

function rootDeclarations(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = [...withoutComments.matchAll(/(^|\})\s*:root\s*\{([^{}]*)\}/g)].map((m) => m[2]).join(';');
  return new Map(
    root
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.startsWith('--'))
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()] as [string, string]),
  );
}

describe('motion tokens', () => {
  const contract = rootDeclarations(readFileSync(path.join(STYLES, 'contract.css'), 'utf8'));

  it.each(MOTION_TOKENS)('%s is declared in contract.css :root with a value', (token) => {
    expect(contract.get(token)).toBeTruthy();
  });

  it('no other theme-core stylesheet declares a motion token, so each has one value in every theme', () => {
    const elsewhere = readdirSync(STYLES)
      .filter((f) => f.endsWith('.css') && f !== 'contract.css')
      .flatMap((f) =>
        MOTION_TOKENS.filter((t) => new RegExp(`${t} *:`).test(readFileSync(path.join(STYLES, f), 'utf8'))).map(
          (t) => `${f}: ${t}`,
        ),
      );
    expect(elsewhere).toEqual([]);
  });
});
