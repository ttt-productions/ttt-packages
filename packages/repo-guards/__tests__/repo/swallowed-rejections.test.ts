import { afterEach, describe, expect, it } from 'vitest';
import {
  swallowedRejectionGuard,
  swallowedRejections,
} from '../../src/modules/repo/swallowed-rejections.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const hitsIn = (source: string) => swallowedRejections(source).length;

describe('which .catch() handlers discard a rejection', () => {
  it('flags an empty handler and one that returns undefined, void 0, or null', () => {
    expect(hitsIn('p.catch(() => {});')).toBe(1);
    expect(hitsIn('p.catch(() => undefined);')).toBe(1);
    expect(hitsIn('p.catch((_error) => void 0);')).toBe(1);
    expect(hitsIn('p.catch(() => null);')).toBe(1);
    expect(hitsIn('p.catch(function () {});')).toBe(1);
    expect(hitsIn('await Promise.all(files.map((f) => rm(f).catch(() => {})));')).toBe(1);
  });

  it('passes a handler that handles the rejection', () => {
    expect(hitsIn('p.catch((error) => report(error));')).toBe(0);
    expect(hitsIn('p.catch(() => fallback);')).toBe(0);
    expect(hitsIn('p.catch(() => { setFailed(true); });')).toBe(0);
    expect(hitsIn('p.catch(report);')).toBe(0);
  });

  it('passes a discard whose reason is on the line above its statement, on its line, or inside it', () => {
    expect(
      hitsIn('// The browser blocks autoplay, and the video stays paused.\np.catch(() => {});'),
    ).toBe(0);
    expect(hitsIn('p.catch(() => {}); // A context already closing rejects.')).toBe(0);
    expect(hitsIn('p.catch(() => {\n  // A context already closing rejects.\n});')).toBe(0);
    expect(
      hitsIn(
        '// A temp file left behind stays in the OS temp folder.\nawait Promise.all(\n  files.map((f) => rm(f).catch(() => {})),\n);',
      ),
    ).toBe(0);
  });

  it('flags a discard whose only comment belongs to an earlier statement', () => {
    expect(hitsIn('// Load the first one.\nload();\np.catch(() => {});')).toBe(1);
    expect(hitsIn('// Load the first one.\n\np.catch(() => {});')).toBe(1);
  });

  it('never reads a mention in a string or a comment', () => {
    expect(hitsIn("const s = 'p.catch(() => {})';")).toBe(0);
    expect(hitsIn('/* p.catch(() => {}) */ const x = 1;')).toBe(0);
  });
});

describe('the swallowed-rejection guard', () => {
  let repo: TempRepo | null = null;
  afterEach(() => {
    repo?.remove();
    repo = null;
  });

  const run = async (
    files: Record<string, string>,
    reviewed: ReadonlyArray<{ path: string; why: string }> = [],
  ) => {
    repo = tempRepo({ 'src/index.ts': 'export {};', ...files });
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: 'src/index.ts' } },
    });
    const [guard] = swallowedRejectionGuard.build({ reviewed });
    const findings = await guard.run(contextOf(reader));
    return findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} — ${f.detail}`);
  };

  it('FLAGS a reasonless discard in source and in a test, naming its line', async () => {
    expect(
      await run({
        'src/play.ts': 'export const go = (p: Promise<void>) => {\n  p.catch(() => {});\n};',
        'src/play.test.ts': "it('x', () => {\n  p.catch(() => undefined);\n});",
      }),
    ).toEqual([
      'src/play.test.ts:2 — a .catch() discards the rejection with no reason',
      'src/play.ts:2 — a .catch() discards the rejection with no reason',
    ]);
  });

  it('passes a reviewed file, and fails a reviewed entry whose file no longer discards one', async () => {
    expect(
      await run({ 'src/play.ts': 'p.catch(() => {});' }, [{ path: 'src/play.ts', why: 'w' }]),
    ).toEqual([]);
    expect(
      await run({ 'src/play.ts': 'p.catch(report);' }, [{ path: 'src/play.ts', why: 'w' }]),
    ).toEqual([
      'src/play.ts — stale reviewed entry: the file no longer discards a rejection without a reason',
    ]);
  });

  it('refuses a reviewed entry with no why', () => {
    expect(
      swallowedRejectionGuard.factProblems({ reviewed: [{ path: 'src/a.ts', why: '' }] }),
    ).toEqual(['reviewed entry src/a.ts carries no why']);
  });
});
