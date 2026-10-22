import { describe, expect, it } from 'vitest';
import {
  enumLabelsGuard,
  schemaBoundsGuard,
  textEntryGuard,
} from '../../src/modules/ui/definitions.js';
import { allFindings } from './helpers.js';

describe('a stored enum value renders through its label map', () => {
  const facts = { fieldNames: ['type', 'status', 'role'], exceptions: [] };

  it('flags each declared field rendered raw, and passes a label-map render and a comparison', async () => {
    const findings = await allFindings(enumLabelsGuard, facts, {
      'src/ui/table.tsx': [
        'export const a = <TableCell>{project.type}</TableCell>;',
        'export const b = <span className="text-xs">{proposal.status}</span>;',
        'export const c = <Badge>{member?.role}</Badge>;',
        'export const d = <TableCell>{STATUS_LABELS[invite.status]}</TableCell>;',
        'export const e = <TableCell>{typeLabel(project.type)}</TableCell>;',
        'export const f = <>{audition.type === "work" && <p>Shares</p>}</>;',
        'export const g = <span>{row.title}</span>;',
      ].join('\n'),
    });
    expect(findings).toEqual([
      'src/ui/table.tsx:1 not on the reviewed list: >{project.type}<',
      'src/ui/table.tsx:2 not on the reviewed list: >{proposal.status}<',
      'src/ui/table.tsx:3 not on the reviewed list: >{member?.role}<',
    ]);
  });

  it('refuses facts that declare no enum field', () => {
    expect(enumLabelsGuard.factProblems({ fieldNames: [], exceptions: [] })).toEqual([
      'fieldNames is empty',
    ]);
  });
});

describe('textEntry appears only on the reviewed non-free-text boxes', () => {
  const box = '<Input id="n" textEntry="numeric" value={n} />';
  const reviewed = [
    { path: 'src/ui/shares.tsx', why: 'stake shares offered (a number)', count: 1 },
  ];

  it('passes exactly the reviewed boxes, and a declared free-text box', async () => {
    expect(
      await allFindings(
        textEntryGuard,
        { reviewed },
        {
          'src/ui/shares.tsx': `export const a = ${box};`,
          'src/ui/title.tsx': 'export const t = <Input inputFormat={TITLE_INPUT} />;',
        },
      ),
    ).toEqual([]);
  });

  it('flags an unreviewed box, one more box than reviewed, and one fewer', async () => {
    expect(
      await allFindings(
        textEntryGuard,
        { reviewed },
        {
          'src/ui/shares.tsx': `export const a = ${box};\nexport const b = ${box};`,
          'src/ui/title.tsx': `export const t = ${box};`,
        },
      ),
    ).toEqual([
      'src/ui/shares.tsx:2 more than the 1 reviewed: textEntry=',
      'src/ui/title.tsx:1 not on the reviewed list: textEntry=',
    ]);
    expect(
      await allFindings(
        textEntryGuard,
        { reviewed: [{ ...reviewed[0], count: 2 }] },
        { 'src/ui/shares.tsx': `export const a = ${box};` },
      ),
    ).toEqual(['src/ui/shares.tsx stale count: reviewed 2, found 1']);
  });

  it('refuses a reviewed entry with no count', () => {
    expect(
      textEntryGuard.factProblems({ reviewed: [{ path: 'src/ui/shares.tsx', why: 'a number' }] }),
    ).toEqual(['reviewed entry src/ui/shares.tsx needs its reviewed count']);
  });
});

describe('every schema bound derives from a named limit', () => {
  const roots = {
    functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
    workers: { chat: { path: 'chat-worker/src', anchor: 'chat-worker/src/index.ts' } },
  };

  it('flags a bare bound in the app, its Functions, and a Worker, and passes named limits, presence checks, and arithmetic', async () => {
    const findings = await allFindings(
      schemaBoundsGuard,
      { exceptions: [] },
      {
        'src/schemas/form.ts':
          'export const s = z.object({ evidence: z.string().max(2000), priority: z.number().int().min(0).max(2) });',
        'functions/src/index.ts': 'export const ids = z.array(z.string()).length(3);',
        'chat-worker/src/index.ts':
          'export const code = z.string().min(6);\nexport const frame = z.string().min(1).max(LIMITS.MAX_FRAME_BYTES);\nexport const backoff = Math.min(60_000 * 2 ** n, 3_600_000);\n// z.string().max(4000) stays a comment',
        'src/schemas/form.test.ts': 'z.string().max(10);',
      },
      roots,
    );
    expect(findings).toEqual([
      'chat-worker/src/index.ts:1 not on the reviewed list: .min(6)',
      'functions/src/index.ts:1 not on the reviewed list: .length(3)',
      'src/schemas/form.ts:1 not on the reviewed list: .max(2000)',
      'src/schemas/form.ts:1 not on the reviewed list: .max(2)',
    ]);
  });

  it('runs over the app alone when the app has no Functions or Workers', async () => {
    expect(
      await allFindings(
        schemaBoundsGuard,
        { exceptions: [] },
        { 'src/schemas/form.ts': 'z.string().max(80);' },
      ),
    ).toEqual(['src/schemas/form.ts:1 not on the reviewed list: .max(80)']);
  });
});
