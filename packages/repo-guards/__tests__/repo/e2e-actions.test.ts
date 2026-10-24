import { afterEach, describe, expect, it } from 'vitest';
import {
  retriedActions,
  retryLoopActionGuard,
  swallowedActionGuard,
  swallowedActions,
} from '../../src/modules/repo/e2e-actions.js';
import { createRepoReader } from '../../src/node/reader.js';
import type { AnchoredEntry } from '../../src/support/anchored-review.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

async function findingsOf(
  definition: typeof retryLoopActionGuard,
  files: Record<string, string>,
  reviewed: AnchoredEntry[] = [],
  actionHelpers: string[] = [],
) {
  repo?.remove();
  repo = tempRepo({ 'src/index.ts': 'export {};', 'e2e/setup.ts': 'export {};', ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/index.ts' },
      e2e: { path: 'e2e', anchor: 'e2e/setup.ts' },
    },
  });
  const [guard] = definition.build({ actionHelpers, reviewed });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file}:${f.line ?? '-'} ${f.detail}`);
}

describe('no end-to-end retry loop repeats a user action', () => {
  it('flags a toPass() or expect.poll() callback that clicks, types, or navigates', () => {
    const loops = [
      'await expect(async () => { await retry.click(); await expect(out).toBeVisible(); }).toPass();',
      'await baseExpect(async () => { await page.reload(); expect(x).toBe(1); }).toPass({ timeout: 9 });',
      'await expect.poll(async () => { await box.fill("a"); return box.inputValue(); }).toBe("a");',
      'await expect(async () => { if (!(await box.isChecked())) await box.click(); }).toPass();',
    ];
    for (const loop of loops) expect(retriedActions(loop), loop).toHaveLength(1);
  });

  it("flags the app's own action helpers it is told about", () => {
    const loop = 'await expect(async () => { await clickWhenSettled(btn); }).toPass();';
    expect(retriedActions(loop)).toEqual([]);
    expect(retriedActions(loop, ['clickWhenSettled'])).toHaveLength(1);
  });

  it('passes a loop that only re-reads state, and an action outside any loop', () => {
    expect(
      retriedActions(
        'await btn.click(); await expect(async () => { expect(await read()).toBe(2); }).toPass();',
      ),
    ).toEqual([]);
    expect(
      retriedActions('await expect.poll(async () => (await getDoc(path)) !== null).toBe(true);'),
    ).toEqual([]);
  });

  it('excuses the one reviewed loop its anchor names, and fails a second loop in the same file', async () => {
    const spec = [
      "await expect(async () => { await page.reload(); await expect(page.getByText('Row A')).toBeVisible(); }).toPass();",
      "await expect(async () => { await page.reload(); await expect(page.getByText('Row B')).toBeVisible(); }).toPass();",
    ].join('\n');
    const reviewed = [
      { path: 'e2e/a.spec.ts', anchor: "getByText('Row A')", why: 'waits for a trigger' },
    ];
    expect(await findingsOf(retryLoopActionGuard, { 'e2e/a.spec.ts': spec }, reviewed)).toEqual([
      'e2e/a.spec.ts:2 a retry loop repeats reload() until it passes',
    ]);
  });

  it('reports a stale entry, and an anchor that matches two loops', async () => {
    const reviewed = [{ path: 'e2e/a.spec.ts', anchor: 'reload', why: 'waits for a trigger' }];
    const twoLoops = [
      'await expect(async () => { await page.reload(); }).toPass();',
      'await expect(async () => { await page.reload(); }).toPass();',
    ].join('\n');
    expect(await findingsOf(retryLoopActionGuard, { 'e2e/a.spec.ts': twoLoops }, reviewed)).toEqual(
      [
        'e2e/a.spec.ts:2 a retry loop repeats reload() until it passes, and its reviewed anchor "reload" already excuses another occurrence — make each anchor name one occurrence',
      ],
    );
    expect(
      await findingsOf(retryLoopActionGuard, { 'e2e/a.spec.ts': 'export {};' }, reviewed),
    ).toEqual([
      'e2e/a.spec.ts:- stale reviewed entry "reload": its anchor names no retry loop that acts',
    ]);
  });
});

describe('no end-to-end action or state read swallows its failure', () => {
  it('flags a .catch() on an action or a state read, and a try/catch around an action', () => {
    const swallowed = [
      'await pay.click().catch(() => {});',
      'await box.first().uncheck().catch(() => undefined);',
      'if (await sheet.isVisible().catch(() => false)) return;',
      'expect(await submit.isEnabled().catch(() => false)).toBe(false);',
      'try { await page.goto(url); } catch { /* moved on */ }',
    ];
    for (const code of swallowed) expect(swallowedActions(code), code).toHaveLength(1);
    expect(
      swallowedActions('await clickWhenSettled(x).catch(() => {});', ['clickWhenSettled']),
    ).toHaveLength(1);
  });

  it('passes a catch that rethrows, a catch on a non-action, and a plain state read', () => {
    const fine = [
      "await pay.click().catch((e) => { throw new Error('pay failed', { cause: e }); });",
      'try { await page.goto(url); } catch (e) { throw e; }',
      'await response.dispose().catch(() => {});',
      'const body = await res.text().catch(() => "");',
      'if (await sheet.isVisible()) return;',
    ];
    for (const code of fine) expect(swallowedActions(code), code).toEqual([]);
  });

  it('excuses only the reviewed occurrence its anchor names', async () => {
    const spec = [
      'await save.uncheck().catch(() => {});',
      'await pay.click().catch(() => {});',
    ].join('\n');
    const reviewed = [
      { path: 'e2e/a.spec.ts', anchor: 'save.uncheck()', why: 'optional vendor control' },
    ];
    expect(await findingsOf(swallowedActionGuard, { 'e2e/a.spec.ts': spec }, reviewed)).toEqual([
      'e2e/a.spec.ts:2 a .catch() swallows a failed click()',
    ]);
  });
});

describe('the e2e action facts', () => {
  it('require a why and an anchor on every reviewed entry', () => {
    expect(
      retryLoopActionGuard.factProblems({
        actionHelpers: [],
        reviewed: [{ path: 'e2e/a.spec.ts', anchor: '', why: 'x' } as AnchoredEntry],
      }),
    ).toEqual([
      'reviewed entry e2e/a.spec.ts names no anchor (the source text naming the one occurrence it excuses)',
    ]);
    expect(
      swallowedActionGuard.factProblems({
        actionHelpers: [],
        reviewed: [{ path: 'e2e/a.spec.ts', anchor: 'x', why: '' }],
      }),
    ).toEqual(['reviewed entry e2e/a.spec.ts x carries no why']);
  });
});
