import { describe, expect, it } from 'vitest';
import {
  sharedTruncationGuard,
  type SharedTruncationFacts,
} from '../../src/modules/ui/truncation.js';
import { allFindings } from './helpers.js';

const lines = (...l: string[]) => l.join('\n');

const facts = (overrides: Partial<SharedTruncationFacts> = {}): SharedTruncationFacts => ({
  entryStylesheet: 'src/styles/globals.css',
  trees: ['src/ui', 'src/styles'],
  sharedClass: 'kit-truncate',
  clampOwners: [
    { selector: '.kit-truncate', why: 'the shared one-line truncation class' },
    { selector: '.kit-clamp-3', why: 'the shared three-line clamp' },
  ],
  exceptions: [],
  ...overrides,
});

const sheet = lines(
  '.kit-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '.kit-clamp-3 { @apply line-clamp-3; }',
  '.card { text-overflow: clip; }',
);
const clean = {
  'src/styles/globals.css': "@import './components.css' layer(base);",
  'src/styles/components.css': sheet,
  'src/ui/title.tsx': lines(
    '// a truncate or line-clamp-2 class would break the recipe',
    'export const T = ({ t }) => <h2 className="font-bold kit-truncate" title={t}>{t}</h2>;',
    'export const mode = "truncated";',
  ),
};

describe('titles and names truncate through the one shared class', () => {
  it('passes the shared class, the clamp owners, comments, and lookalike words', async () => {
    expect(await allFindings(sharedTruncationGuard, facts(), clean)).toEqual([]);
  });

  it('flags every per-call-site truncation utility in strings, templates, and className expressions', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/bad.tsx': lines(
        'export const a = <p className="truncate" />;',
        'export const b = <p className={`md:line-clamp-2 ${x}`} />;',
        "export const c = <p className={open ? 'line-clamp-none' : 'text-ellipsis'} />;",
        "export const d = cn('!line-clamp-[3]', 'p-2');",
        "export const e = <p style={{ textOverflow: 'ellipsis', WebkitLineClamp: 2 }} />;",
        'export const f = <p style={{ lineClamp: 2 }} />;',
      ),
    });
    expect(findings).toEqual([
      'src/ui/bad.tsx:1 not on the reviewed list: truncate',
      'src/ui/bad.tsx:2 not on the reviewed list: md:line-clamp-2',
      'src/ui/bad.tsx:3 not on the reviewed list: line-clamp-none',
      'src/ui/bad.tsx:3 not on the reviewed list: text-ellipsis',
      'src/ui/bad.tsx:4 not on the reviewed list: !line-clamp-[3]',
      'src/ui/bad.tsx:5 not on the reviewed list: inline textOverflow',
      'src/ui/bad.tsx:5 not on the reviewed list: inline WebkitLineClamp',
      'src/ui/bad.tsx:6 not on the reviewed list: inline lineClamp',
    ]);
  });

  it('flags a stylesheet clamp outside the clamp owners, including a rule that mixes an owner with another selector', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/styles/page.css': lines(
        '.card-title { text-overflow: ellipsis; }',
        '.kit-truncate, .row-name { -webkit-line-clamp: 2; }',
        '@media (min-width: 40rem) { .wide { @apply truncate; } }',
        '.blurb { line-clamp: 3; }',
      ),
    });
    expect(findings).toEqual([
      'src/styles/page.css:1 not on the reviewed list: text-overflow: ellipsis',
      'src/styles/page.css:2 not on the reviewed list: -webkit-line-clamp: 2',
      'src/styles/page.css:3 not on the reviewed list: @apply truncate',
      'src/styles/page.css:4 not on the reviewed list: line-clamp: 3',
    ]);
  });

  it('leaves code outside the trees and test code alone', async () => {
    expect(
      await allFindings(sharedTruncationGuard, facts(), {
        ...clean,
        'src/other/x.tsx': 'export const a = <p className="truncate" />;',
        'src/ui/x.test.tsx': 'expect(el.className).toContain("truncate");',
      }),
    ).toEqual([]);
  });

  it('passes a reviewed exception and flags it once it no longer truncates', async () => {
    const reviewed = facts({
      exceptions: [{ path: 'src/ui/code-block.tsx', why: 'a code sample clipped to one line' }],
    });
    expect(
      await allFindings(sharedTruncationGuard, reviewed, {
        ...clean,
        'src/ui/code-block.tsx': 'export const C = () => <pre className="truncate" />;',
      }),
    ).toEqual([]);
    expect(
      await allFindings(sharedTruncationGuard, reviewed, {
        ...clean,
        'src/ui/code-block.tsx': 'export const C = () => <pre className="kit-truncate" />;',
      }),
    ).toEqual([
      'src/ui/code-block.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });

  it('flags a clamp owner whose rule no longer truncates and a tree with nothing to read', async () => {
    const findings = await allFindings(
      sharedTruncationGuard,
      facts({ trees: ['src/ui', 'src/styles', 'src/gone'] }),
      {
        ...clean,
        'src/styles/components.css': lines(
          '.kit-truncate { overflow: hidden; text-overflow: ellipsis; }',
          '.kit-clamp-3 { overflow: hidden; }',
        ),
      },
    );
    expect(findings).toEqual([
      'src/gone the tree holds no production code or stylesheet the guard can read',
      '(clampOwners) stale clamp owner: no stylesheet rule for .kit-clamp-3 truncates any more',
    ]);
  });

  it('passes clamp owners declared only by an installed theme package the entry stylesheet loads', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'node_modules/@kit/theme/package.json': JSON.stringify({
        name: '@kit/theme',
        exports: { './components.css': './dist/components.css' },
      }),
      'node_modules/@kit/theme/dist/components.css': sheet,
      'src/styles/globals.css': "@import '@kit/theme/components.css' layer(base);",
      'src/styles/components.css': '.card { text-overflow: clip; }',
    });
    expect(findings).toEqual([]);
  });

  it('flags an owner the installed theme package no longer clamps, and an entry stylesheet that is gone', async () => {
    const files = {
      ...clean,
      'node_modules/@kit/theme/package.json': JSON.stringify({
        name: '@kit/theme',
        exports: { './components.css': './dist/components.css' },
      }),
      'node_modules/@kit/theme/dist/components.css':
        '.kit-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      'src/styles/globals.css': "@import '@kit/theme/components.css' layer(base);",
      'src/styles/components.css': '.card { text-overflow: clip; }',
    };
    expect(await allFindings(sharedTruncationGuard, facts(), files)).toEqual([
      '(clampOwners) stale clamp owner: no stylesheet rule for .kit-clamp-3 truncates any more',
    ]);
    expect(
      await allFindings(
        sharedTruncationGuard,
        facts({ entryStylesheet: 'src/styles/missing.css' }),
        clean,
      ),
    ).toEqual(['src/styles/missing.css the entry stylesheet does not exist']);
  });

  it('refuses a shared class that is a utility or that no clamp owner holds', () => {
    expect(sharedTruncationGuard.factProblems(facts({ sharedClass: 'truncate' }))).toEqual([
      'sharedClass truncate is itself a per-call-site utility',
      "clampOwners does not hold the shared class's selector .truncate",
    ]);
  });
});
