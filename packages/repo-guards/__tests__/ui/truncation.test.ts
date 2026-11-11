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
  clipClasses: ['kit-truncate', 'kit-clamp-3'],
  clampOwners: [
    { selector: '.kit-truncate', why: 'the shared one-line truncation class' },
    { selector: '.kit-clamp-3', why: 'the shared three-line clamp' },
  ],
  breakClasses: ['kit-inline-name', 'kit-machine-text'],
  breakOwners: [
    { selector: '.kit-inline-name', why: 'the shared name-in-a-sentence class' },
    { selector: '.kit-machine-text', why: 'the shared machine-text class' },
  ],
  exceptions: [],
  ...overrides,
});

const sheet = lines(
  '.kit-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '.kit-clamp-3 { @apply line-clamp-3; }',
  '.card { text-overflow: clip; }',
  '.kit-inline-name { overflow-wrap: anywhere; }',
  '.kit-machine-text { word-break: break-all; }',
  '.prose { overflow-wrap: break-word; }',
);
const clean = {
  'src/styles/globals.css': "@import './components.css' layer(base);",
  'src/styles/components.css': sheet,
  'src/ui/title.tsx': lines(
    '// a truncate or line-clamp-2 class would break the recipe',
    'export const T = ({ t }) => <ClippedText as="h2" className="font-bold" text={t} />;',
    'export const mode = "truncated";',
    'export const C = ({ t }) => <ClippedText asChild text={t}><CardTitle variant="page" /></ClippedText>;',
    'export const N = ({ n }) => <p>Delete <InlineName name={n} />?</p>;',
    'export const M = ({ id }) => <MachineText as="code" text={id} />;',
    'export const K = ({ id }) => <MachineText asChild text={id}><CardTitle /></MachineText>;',
    'export const L = ({ id }) => <p>User ID: <ClippedText text={id} /></p>;',
    'export const W = ({ l, t }) => <p>{l}{t && <ClippedText text={t} />}</p>;',
    'export const V = ({ t }) => <p>{t ? <ClippedText text={t} /> : "Untitled"}</p>;',
  ),
};

describe('text is clipped only through the clip component, never by a class placed by hand', () => {
  it('passes ClippedText as a tag or over a component, InlineName, MachineText, the owners, comments, and lookalike words', async () => {
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
        'src/ui/code-block.tsx': 'export const C = () => <pre className="font-mono" />;',
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
          '.kit-inline-name { overflow-wrap: anywhere; }',
          '.kit-machine-text { word-break: break-all; }',
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
      'node_modules/@kit/theme/dist/components.css': lines(
        '.kit-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.kit-inline-name { overflow-wrap: anywhere; }',
        '.kit-machine-text { word-break: break-all; }',
      ),
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

  it('flags a plain tag under ClippedText or MachineText asChild, and a plain tag that holds only a ClippedText', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/forms.tsx': lines(
        'export const a = ({ t }) => <ClippedText asChild text={t}><h2 className="x" /></ClippedText>;',
        'export const b = ({ t }) => <h2 className="font-bold"><ClippedText text={t} /></h2>;',
        'export const c = ({ t }) => (',
        '  <li key={t}>',
        '    {/* the row */}',
        '    <ClippedText text={t} />',
        '  </li>',
        ');',
        'export const d = ({ id }) => <MachineText asChild text={id}><code className="x" /></MachineText>;',
      ),
    });
    expect(findings).toEqual([
      'src/ui/forms.tsx:1 not on the reviewed list: ClippedText asChild over a plain <h2> (name the tag with as)',
      'src/ui/forms.tsx:2 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/forms.tsx:4 not on the reviewed list: a plain <li> holding only ClippedText (name the tag with as)',
      'src/ui/forms.tsx:9 not on the reviewed list: MachineText asChild over a plain <code> (name the tag with as)',
    ]);
  });

  it('looks through braces: a plain tag holding only a ClippedText behind &&, a bare expression, or a conditional is flagged', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/braces.tsx': lines(
        'export const a = ({ t }) => <h2>{t && <ClippedText text={t} />}</h2>;',
        'export const b = ({ t }) => <h2>{<ClippedText text={t} />}</h2>;',
        'export const c = ({ a, b }) => <h2>{a ? <ClippedText text={a} /> : <ClippedText text={b} />}</h2>;',
        'export const d = ({ t }) => <h2>{t ? (<ClippedText text={t} />) : null}</h2>;',
        'export const e = ({ t }) => <div className="flex min-w-0"><ClippedText text={t} /></div>;',
      ),
    });
    expect(findings).toEqual([
      'src/ui/braces.tsx:1 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/braces.tsx:2 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/braces.tsx:3 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/braces.tsx:4 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/braces.tsx:5 not on the reviewed list: a plain <div> holding only ClippedText (name the tag with as)',
    ]);
  });

  it('resolves ClippedText and MachineText imported under another name or through a namespace', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/aliased.tsx': lines(
        "import { ClippedText as Clip, MachineText as Raw } from '@kit/ui/react';",
        "import * as UI from '@kit/ui/react';",
        'export const a = ({ t }) => <h2><Clip text={t} /></h2>;',
        'export const b = ({ t }) => <Clip asChild text={t}><p /></Clip>;',
        'export const c = ({ id }) => <Raw asChild text={id}><code /></Raw>;',
        'export const d = ({ t }) => <li><UI.ClippedText text={t} /></li>;',
      ),
    });
    expect(findings).toEqual([
      'src/ui/aliased.tsx:3 not on the reviewed list: a plain <h2> holding only ClippedText (name the tag with as)',
      'src/ui/aliased.tsx:4 not on the reviewed list: ClippedText asChild over a plain <p> (name the tag with as)',
      'src/ui/aliased.tsx:5 not on the reviewed list: MachineText asChild over a plain <code> (name the tag with as)',
      'src/ui/aliased.tsx:6 not on the reviewed list: a plain <li> holding only ClippedText (name the tag with as)',
    ]);
  });

  it('flags machine-text breaking placed by hand in code, inline styles, and stylesheets outside the break owners', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/ids.tsx': lines(
        'export const a = <code className="font-mono break-all">{id}</code>;',
        "export const b = <p className={cn('sm:wrap-anywhere', x)} />;",
        "export const c = <p className='[overflow-wrap:anywhere]' />;",
        'export const d = <span className="kit-machine-text">{id}</span>;',
        "export const e = <p style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }} />;",
        "export const f = <p style={{ overflowWrap: 'break-word' }} />;",
      ),
      'src/styles/ids.css': lines(
        '.account-id { word-break: break-all; }',
        '.banner-text { overflow-wrap: anywhere; }',
        '.kit-machine-text, .row-id { word-wrap: anywhere; }',
        '.hash { @apply break-all; }',
      ),
    });
    expect(findings).toEqual([
      'src/styles/ids.css:1 not on the reviewed list: word-break: break-all',
      'src/styles/ids.css:2 not on the reviewed list: overflow-wrap: anywhere',
      'src/styles/ids.css:3 not on the reviewed list: word-wrap: anywhere',
      'src/styles/ids.css:4 not on the reviewed list: @apply break-all',
      'src/ui/ids.tsx:1 not on the reviewed list: break-all',
      'src/ui/ids.tsx:2 not on the reviewed list: sm:wrap-anywhere',
      'src/ui/ids.tsx:3 not on the reviewed list: [overflow-wrap:anywhere]',
      'src/ui/ids.tsx:4 not on the reviewed list: kit-machine-text placed by hand',
      'src/ui/ids.tsx:5 not on the reviewed list: inline wordBreak: break-all',
      'src/ui/ids.tsx:5 not on the reviewed list: inline overflowWrap: anywhere',
    ]);
  });

  it('flags a break owner no loaded stylesheet breaks with any more', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/styles/components.css': lines(
        '.kit-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.kit-clamp-3 { @apply line-clamp-3; }',
        '.kit-inline-name { overflow-wrap: anywhere; }',
        '.kit-machine-text { word-break: normal; }',
      ),
    });
    expect(findings).toEqual([
      '(breakOwners) stale break owner: no stylesheet rule for .kit-machine-text breaks anywhere any more',
    ]);
  });

  it('flags a clip class placed by hand in a className, a template, and a class helper', async () => {
    const findings = await allFindings(sharedTruncationGuard, facts(), {
      ...clean,
      'src/ui/hand.tsx': lines(
        'export const a = <h2 className="font-bold kit-truncate">{t}</h2>;',
        'export const b = <p className={`md:kit-clamp-3 ${x}`} />;',
        "export const c = cn('p-2', open && 'kit-truncate');",
      ),
    });
    expect(findings).toEqual([
      'src/ui/hand.tsx:1 not on the reviewed list: kit-truncate placed by hand',
      'src/ui/hand.tsx:2 not on the reviewed list: md:kit-clamp-3 placed by hand',
      'src/ui/hand.tsx:3 not on the reviewed list: kit-truncate placed by hand',
    ]);
  });

  it('refuses clip and break classes that are missing, empty, or a per-call-site utility', () => {
    expect(sharedTruncationGuard.factProblems(facts({ clipClasses: ['truncate'] }))).toEqual([
      'clipClasses truncate is itself a per-call-site utility',
    ]);
    expect(sharedTruncationGuard.factProblems(facts({ clipClasses: [] }))).toEqual([
      'clipClasses is empty',
    ]);
    expect(sharedTruncationGuard.factProblems(facts({ breakClasses: ['break-all'] }))).toEqual([
      'breakClasses break-all is itself a per-call-site utility',
    ]);
    expect(sharedTruncationGuard.factProblems(facts({ breakOwners: [] }))).toEqual([
      'breakOwners is empty',
    ]);
  });
});
