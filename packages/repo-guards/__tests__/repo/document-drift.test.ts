import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentDriftGuard, firstDifferingLine } from '../../src/modules/repo/document-drift.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const DOC = 'docs/preferences.md';
let workspace: TempRepo | undefined;
afterEach(() => workspace?.remove());

/**
 * A workspace holding this repository (`app/`) and its sibling (`sibling/`): the sibling's copy of the
 * document, a sibling checkout that holds no copy (`'no copy'`), or no sibling checkout at all.
 */
function setUp(ours: string, theirs: string | 'no copy' | 'no checkout') {
  workspace = tempRepo({ 'app/src/index.ts': 'export {};', [`app/${DOC}`]: ours });
  if (theirs !== 'no checkout') mkdirSync(join(workspace.root, 'sibling', 'docs'), { recursive: true });
  if (theirs !== 'no checkout' && theirs !== 'no copy') writeFileSync(join(workspace.root, 'sibling', DOC), theirs);
  const reader = createRepoReader({ repoRoot: join(workspace.root, 'app'), roots: { app: { path: 'src', anchor: 'src/index.ts' } } });
  const [guard] = documentDriftGuard.build({ file: DOC, copies: [{ name: 'sibling', checkout: '../sibling' }] });
  return { reader, guard };
}

describe('a document kept identical across sibling repositories', () => {
  it('passes identical copies', async () => {
    const { reader, guard } = setUp('# One\ntext\n', '# One\ntext\n');
    expect(guard.skipReason!(reader)).toBeNull();
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('FLAGS a copy that drifted, at the first line that differs', async () => {
    const { reader, guard } = setUp('# One\ntext\nmore\n', '# One\ntext\nchanged\n');
    expect(await guard.run(contextOf(reader))).toEqual([{ file: DOC, line: 3, detail: "differs from sibling's copy from this line on" }]);
  });

  it('is SKIPPED, with its reason, only where the sibling checkout is absent — never passed', () => {
    const { reader, guard } = setUp('# One\n', 'no checkout');
    expect(guard.skipReason!(reader)).toBe('sibling is not checked out beside this repository (CI checks out one repository)');
  });

  it('FLAGS a sibling checkout that is there but has lost its copy, rather than skipping it', async () => {
    const { reader, guard } = setUp('# One\n', 'no copy');
    expect(guard.skipReason!(reader)).toBeNull();
    expect(await guard.run(contextOf(reader))).toEqual([{ file: DOC, detail: `sibling is checked out here but holds no copy of ${DOC}` }]);
  });

  it("fails when this repository's own copy is gone", async () => {
    const { reader, guard } = setUp('# One\n', '# One\n');
    workspace!.remove();
    await expect(Promise.resolve().then(() => guard.run(contextOf(reader)))).rejects.toThrow(/does not exist|cannot read/);
  });

  it('finds the first differing line, and none for identical texts', () => {
    expect(firstDifferingLine('a\nb', 'a\nb')).toBeNull();
    expect(firstDifferingLine('a\nb', 'a\nc')).toBe(2);
    expect(firstDifferingLine('a', 'a\nb')).toBe(2);
  });

  it('refuses facts with no document, no copy, or a copy listed twice', () => {
    expect(documentDriftGuard.factProblems({ file: '', copies: [] })).toEqual(['file is missing', 'copies is empty']);
    expect(
      documentDriftGuard.factProblems({ file: DOC, copies: [{ name: 'a', checkout: '../a' }, { name: 'a', checkout: '../b' }] }),
    ).toEqual(['copies lists a twice']);
  });
});
