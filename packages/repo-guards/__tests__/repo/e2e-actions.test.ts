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

  it('flags a for (;;), while, or do loop that repeats an action, condition included', () => {
    const loops = [
      'for (let attempt = 0; attempt < 5; attempt++) { await retry.click(); if (await done()) break; }',
      'for (;;) { await page.reload(); if (await row.count()) break; }',
      'while (!(await row.count())) await page.goto(url);',
      'do { await box.fill("a"); } while ((await box.inputValue()) !== "a");',
      'while (!(await clickWhenSettled(btn))) await settle();',
    ];
    expect(retriedActions(loops[0])).toEqual([
      { start: 0, end: loops[0].length, detail: 'a for / while / do loop repeats click()' },
    ]);
    for (const loop of loops.slice(1, 4)) expect(retriedActions(loop), loop).toHaveLength(1);
    expect(retriedActions(loops[4], ['clickWhenSettled'])).toHaveLength(1);
  });

  it('passes a for…of walk over a list, and a loop that only re-reads state', () => {
    expect(retriedActions('for (const box of boxes) await box.check();')).toEqual([]);
    expect(retriedActions('for (const key in fields) await page.fill(key, fields[key]);')).toEqual(
      [],
    );
    expect(retriedActions('while (!(await row.count())) await settle();')).toEqual([]);
  });

  it('reports a repeat nested inside another repeat once, at the outer loop', () => {
    const nested =
      'for (let i = 0; i < 3; i++) { await expect(async () => { await retry.click(); }).toPass(); }';
    expect(retriedActions(nested)).toEqual([
      { start: 0, end: nested.length, detail: 'a for / while / do loop repeats click()' },
    ]);
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

  it('flags a loop that acts through a function declared in the same file, naming the path', () => {
    const spec = [
      'async function openWork(page) { await page.goto("/work"); }',
      'const refresh = async (page) => { await openWork(page); };',
      'await expect(async () => { await refresh(page); await expect(row).toBeVisible(); }).toPass();',
    ].join('\n');
    expect(retriedActions(spec).map((hit) => hit.detail)).toEqual([
      'a retry loop repeats goto() through refresh → openWork until it passes',
    ]);
  });

  it('passes a loop whose same-file helper only reads, a recursive helper, and a method call it cannot follow', () => {
    const spec = [
      'async function readRows(page) { return page.getByRole("row").count(); }',
      'async function settle(n) { if (n > 0) await settle(n - 1); }',
      'await expect.poll(async () => { await settle(3); return readRows(page); }).toBe(2);',
      'while (!(await done())) await journey.openWork(page);',
    ].join('\n');
    expect(retriedActions(spec)).toEqual([]);
  });

  it('follows a helper imported from another file of the suite', async () => {
    const files = {
      'e2e/helpers/work.ts': 'export async function openWork(page) { await page.goto("/work"); }',
      'e2e/a.spec.ts': [
        "import { openWork as visit } from './helpers/work.js';",
        'await expect(async () => { await visit(page); await expect(row).toBeVisible(); }).toPass();',
      ].join('\n'),
    };
    expect(await findingsOf(retryLoopActionGuard, files)).toEqual([
      'e2e/a.spec.ts:2 a retry loop repeats goto() through visit until it passes',
    ]);
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

  it('flags a .catch() or a try/catch around a call to a suite function that acts', async () => {
    const files = {
      'e2e/helpers/console.ts':
        'export async function refreshConsole(page) { await page.getByRole("button").click(); }',
      'e2e/a.spec.ts': [
        "import { refreshConsole } from './helpers/console.js';",
        'await refreshConsole(page).catch(() => {});',
        'try { await refreshConsole(page); } catch { /* moved on */ }',
        'await readConsole(page).catch(() => {});',
      ].join('\n'),
    };
    expect(await findingsOf(swallowedActionGuard, files)).toEqual([
      'e2e/a.spec.ts:2 a .catch() swallows a failed click() through refreshConsole',
      'e2e/a.spec.ts:3 a try/catch swallows a failed click() through refreshConsole',
    ]);
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
