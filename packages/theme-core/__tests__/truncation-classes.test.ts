import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const components = readFileSync(
  path.resolve(__dirname, '../src/styles/components.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function declarationsOf(selector: string): Record<string, string> {
  const rules = [...components.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, selectors]) => selectors.trim() === selector,
  );
  expect(rules, `${selector} is declared by exactly one rule`).toHaveLength(1);
  return Object.fromEntries(
    rules[0][2]
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const at = d.indexOf(':');
        return [d.slice(0, at).trim(), d.slice(at + 1).trim()];
      }),
  );
}

describe('the shared truncation classes', () => {
  it('clips a name to one line with an ellipsis, and lets it shrink inside a flex row', () => {
    expect(declarationsOf('.single-line-truncate')).toEqual({
      'min-width': '0',
      overflow: 'hidden',
      'white-space': 'nowrap',
      'text-overflow': 'ellipsis',
    });
  });

  it('clamps a block of text to two lines', () => {
    expect(declarationsOf('.two-line-clamp')).toEqual({
      display: '-webkit-box',
      '-webkit-line-clamp': '2',
      '-webkit-box-orient': 'vertical',
      overflow: 'hidden',
    });
  });

  it('clamps a block of text to three lines', () => {
    expect(declarationsOf('.three-line-clamp')).toEqual({
      display: '-webkit-box',
      '-webkit-line-clamp': '3',
      '-webkit-box-orient': 'vertical',
      overflow: 'hidden',
    });
  });

  it('makes a name piece an inline block no wider than its line that keeps its link underline', () => {
    expect(declarationsOf('.name-piece')).toEqual({
      display: 'inline-block',
      'max-width': '100%',
      'vertical-align': 'top',
      'text-decoration': 'inherit',
    });
  });
});

describe('the shared text that wraps and is never cut', () => {
  it('lets a name in a sentence break mid-word only where it has no space to wrap at, and never clips it', () => {
    expect(declarationsOf('.inline-name')).toEqual({ 'overflow-wrap': 'anywhere' });
  });

  it('breaks machine text at any character and never clips it', () => {
    expect(declarationsOf('.machine-text')).toEqual({ 'word-break': 'break-all' });
  });
});
