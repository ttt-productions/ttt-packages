import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCleanup } from '../../src/node/tooling/cleanup.js';
import { adcCandidatePaths, devLoginPlan, runDevLogin } from '../../src/node/tooling/dev-login.js';
import { isStackProcess, killDevStack, listeningOn } from '../../src/node/tooling/dev-stack.js';
import { analyzeFieldLineage } from '../../src/node/tooling/field-lineage.js';
import { checkPlaybookRefs, runPlaybookRefsCli } from '../../src/node/tooling/playbook-refs.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'tooling-local-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const put = (rel: string, text = ''): void => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), text);
};

describe('dev:kill matching', () => {
  const signatures = ['next start', 'firebase emulators:start', 'bundle.mjs --watch'];

  it("matches only this repository's stack processes, never another product's", () => {
    const config = {
      name: 'Demo',
      ports: [3000],
      signatures,
      repoMarkers: ['demo-app', 'demo-dev'],
    };
    expect(
      isStackProcess(config, 'node C:\\work\\demo-app\\node_modules\\.bin\\next start -p 3000'),
    ).toBe(true);
    expect(isStackProcess(config, 'node firebase emulators:start --project demo-dev')).toBe(true);
    expect(isStackProcess(config, 'node C:\\work\\Demo-App\\scripts\\bundle.mjs --watch')).toBe(
      true,
    );
    expect(isStackProcess(config, 'node C:\\work\\other-app\\node_modules\\.bin\\next start')).toBe(
      false,
    );
    expect(isStackProcess(config, 'node C:\\work\\demo-app\\scripts\\report.mjs')).toBe(false);
  });

  it("refuses to run with no repository marker, since it could then kill another product's stack", () => {
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    expect(() =>
      killDevStack({ name: 'Demo', ports: [3000], signatures, repoMarkers: [] }),
    ).toThrow('exit 1');
  });

  it('reads the listening rows on the stack ports from netstat output', () => {
    const netstat = [
      '  TCP    0.0.0.0:3000      0.0.0.0:0      LISTENING       111',
      '  TCP    127.0.0.1:8080    0.0.0.0:0      LISTENING       222',
      '  TCP    127.0.0.1:9999    0.0.0.0:0      LISTENING       333',
      '  TCP    127.0.0.1:3000    127.0.0.1:5000 ESTABLISHED     444',
    ].join('\r\n');
    expect(listeningOn(netstat, new Set([3000, 8080]))).toEqual([
      [3000, '111'],
      [8080, '222'],
    ]);
  });
});

describe('playbook references', () => {
  const appFolder = {
    dir: 'docs/playbooks',
    refsRoot: '.',
    pathPrefixes: ['src', '.github'],
    rootFiles: ['package.json'],
    minChecked: 1,
  };
  const sharedFolder = {
    dir: 'node_modules/@scope/standards/playbooks',
    refsRoot: 'node_modules/@scope/standards',
    pathPrefixes: ['rules', 'playbooks'],
    rootFiles: ['preferences.md'],
    minChecked: 1,
  };
  const config = (...folders: (typeof appFolder)[]) => ({
    repoRoot: dir,
    folders: folders.length > 0 ? folders : [appFolder],
  });

  it('finds every cited file that is gone, once per playbook, and checks the rest', () => {
    put('src/real.ts');
    put('package.json', '{}');
    put(
      'docs/playbooks/audit.md',
      [
        'Read `src/real.ts:12` and `src/gone.ts`, then src/gone.ts again.',
        'The root `package.json` and `.github/workflows/missing.yml`.',
        'A pattern `src/**/*.ts` and <!-- no-check --> `src/hypothetical.ts`.',
      ].join('\n'),
    );
    const { folders, misses, shortfalls } = checkPlaybookRefs(config());
    expect(folders).toEqual([{ dir: 'docs/playbooks', checked: 4, minChecked: 1 }]);
    expect(misses).toEqual([
      { file: 'docs/playbooks/audit.md', line: 1, token: 'src/gone.ts' },
      { file: 'docs/playbooks/audit.md', line: 2, token: '.github/workflows/missing.yml' },
    ]);
    expect(shortfalls).toEqual([]);
  });

  it('strips every line-anchor and fragment form before checking the path', () => {
    put('src/real.ts');
    put(
      'docs/playbooks/a.md',
      '`src/real.ts#L4-L9` `src/real.ts#L12` `src/real.ts:4-9` `src/real.ts:12:3` `src/real.ts#some-heading` `src/gone.ts#L2`',
    );
    const { folders, misses } = checkPlaybookRefs(config());
    expect(folders[0]!.checked).toBe(2);
    expect(misses).toEqual([{ file: 'docs/playbooks/a.md', line: 1, token: 'src/gone.ts' }]);
  });

  it('a folder is not a file reference that exists', () => {
    mkdirSync(path.join(dir, 'src', 'folder.d'), { recursive: true });
    put('docs/playbooks/a.md', '`src/folder.d`');
    expect(checkPlaybookRefs(config()).misses).toEqual([
      { file: 'docs/playbooks/a.md', line: 1, token: 'src/folder.d' },
    ]);
  });

  it('fails a missing reference inside an installed shared playbook', () => {
    put('node_modules/@scope/standards/rules/core.md');
    put(
      'node_modules/@scope/standards/playbooks/audit.md',
      'Audit against `rules/core.md` and `rules/gone.md`.',
    );
    const { misses } = checkPlaybookRefs(config(sharedFolder));
    expect(misses).toEqual([
      { file: 'node_modules/@scope/standards/playbooks/audit.md', line: 1, token: 'rules/gone.md' },
    ]);
  });

  it("resolves a shared folder's references against its package and the app's against the repository", () => {
    put('node_modules/@scope/standards/rules/shared-only.md');
    put('node_modules/@scope/standards/preferences.md');
    put('rules/app-only.md');
    put('src/real.ts');
    put(
      'node_modules/@scope/standards/playbooks/audit.md',
      '`rules/shared-only.md` `rules/app-only.md` `preferences.md`',
    );
    put('docs/playbooks/audit.md', '`src/real.ts` `rules/app-only.md`');
    const appWithRules = { ...appFolder, pathPrefixes: ['src', 'rules'] };
    const { folders, misses } = checkPlaybookRefs(config(sharedFolder, appWithRules));
    expect(folders).toEqual([
      { dir: 'node_modules/@scope/standards/playbooks', checked: 3, minChecked: 1 },
      { dir: 'docs/playbooks', checked: 2, minChecked: 1 },
    ]);
    expect(misses).toEqual([
      {
        file: 'node_modules/@scope/standards/playbooks/audit.md',
        line: 1,
        token: 'rules/app-only.md',
      },
    ]);
  });

  it('skips a path holding a placeholder and never takes a rule ID for a path', () => {
    put('src/real.ts');
    put(
      'docs/playbooks/a.md',
      [
        '`src/<APP_DATA_PACKAGE>/paths.ts` and src/<APP_NAME>/page.tsx are filled in by the app.',
        'Cites `RULE-STD-ARCH-209`, RULE-STD-BACKEND-003/006, and `src/real.ts`.',
      ].join('\n'),
    );
    expect(checkPlaybookRefs(config())).toEqual({
      folders: [{ dir: 'docs/playbooks', checked: 1, minChecked: 1 }],
      misses: [],
      shortfalls: [],
    });
  });

  it('reports each folder that checks fewer references than its own floor', () => {
    put('src/real.ts');
    put('node_modules/@scope/standards/rules/core.md');
    put('docs/playbooks/a.md', '`src/real.ts`');
    put('node_modules/@scope/standards/playbooks/a.md', '`rules/core.md`');
    const { shortfalls } = checkPlaybookRefs(
      config({ ...sharedFolder, minChecked: 1 }, { ...appFolder, minChecked: 2 }),
    );
    expect(shortfalls).toEqual([{ dir: 'docs/playbooks', checked: 1, minChecked: 2 }]);
  });

  it('refuses a floor below one, no folder, and a folder that cannot be read', () => {
    put('docs/playbooks/a.md', '`src/real.ts`');
    expect(() => checkPlaybookRefs(config({ ...appFolder, minChecked: 0 }))).toThrow(
      'docs/playbooks needs a minChecked of at least 1',
    );
    expect(() => checkPlaybookRefs({ repoRoot: dir, folders: [] })).toThrow(
      'no playbook folder is configured',
    );
    expect(() => checkPlaybookRefs(config(sharedFolder))).toThrow(
      'cannot read the playbook folder node_modules/@scope/standards/playbooks',
    );
  });

  it("resolves a bare .md token and a link target with no slash against the playbook's own folder", () => {
    put('docs/playbooks/sibling.md');
    put('docs/playbooks/notes.txt');
    put('README.md');
    put(
      'docs/playbooks/a.md',
      [
        'See `sibling.md` and `gone-sibling.md`, and [the index](README.md#steps).',
        'Also [notes](notes.txt), [gone](gone.txt), [a heading](#steps), [up](../README.md).',
        'In code, `[x](not-a-link.md)` is neither a link nor a file name.',
      ].join('\n'),
    );
    const { folders, misses } = checkPlaybookRefs(config());
    expect(folders).toEqual([{ dir: 'docs/playbooks', checked: 5, minChecked: 1 }]);
    expect(misses).toEqual([
      { file: 'docs/playbooks/a.md', line: 1, token: 'gone-sibling.md' },
      { file: 'docs/playbooks/a.md', line: 1, token: 'README.md' },
      { file: 'docs/playbooks/a.md', line: 2, token: 'gone.txt' },
    ]);
  });

  it('a bare token the folder declares as a root file resolves against its root, not the folder', () => {
    put('package.json', '{}');
    put('docs/playbooks/a.md', '`package.json`');
    expect(checkPlaybookRefs(config()).misses).toEqual([]);
  });

  it('counts a sibling reference toward the floor of a folder with no prefixes', () => {
    put('docs/playbooks/sibling.md');
    put('docs/playbooks/a.md', '`sibling.md`');
    const noPrefixes = { ...appFolder, pathPrefixes: [], rootFiles: [] };
    expect(checkPlaybookRefs(config(noPrefixes))).toEqual({
      folders: [{ dir: 'docs/playbooks', checked: 1, minChecked: 1 }],
      misses: [],
      shortfalls: [],
    });
  });

  it('an empty prefix list counts no prefixed path, not every path that starts with a slash', () => {
    put(
      'docs/playbooks/a.md',
      ['`/gone/abs.ts` and /gone/bare.ts', '`src/gone.ts` src/gone-too.ts'].join('\n'),
    );
    const noPrefixes = { ...appFolder, pathPrefixes: [], rootFiles: [] };
    expect(checkPlaybookRefs(config(noPrefixes))).toEqual({
      folders: [{ dir: 'docs/playbooks', checked: 0, minChecked: 1 }],
      misses: [],
      shortfalls: [{ dir: 'docs/playbooks', checked: 0, minChecked: 1 }],
    });
  });

  it('every reference in the shared dev-standards playbooks exists', () => {
    const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const refsRoot = 'packages/dev-standards';
    const { folders, misses, shortfalls } = checkPlaybookRefs({
      repoRoot,
      folders: [
        {
          dir: `${refsRoot}/playbooks`,
          refsRoot,
          pathPrefixes: ['rules', 'playbooks', 'workflows', 'claude', 'work', 'runbooks', 'config'],
          rootFiles: [],
          minChecked: 1,
        },
      ],
    });
    expect(folders[0]!.checked).toBeGreaterThan(0);
    expect(shortfalls).toEqual([]);
    expect(misses).toEqual([]);
  });

  it('the command exits non-zero on a shortfall alone', () => {
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    put('docs/playbooks/a.md', 'No file references here.');
    expect(() => runPlaybookRefsCli(config())).toThrow('exit 1');
  });
});

describe('field lineage', () => {
  const aliasSets = { userRef: ['ownerId', 'authorId'] };

  it('counts every line naming any alias of a concept, in the roots and the extra files', () => {
    put('src/a.ts', 'const ownerId = x;\nconst b = 1;\nconst authorId = ownerId;\n');
    put('src/node_modules/c.ts', 'ownerId');
    put('src/d.txt', 'ownerId');
    put('rules.txt', 'allow if authorId');
    const result = analyzeFieldLineage(
      {
        aliasSets,
        roots: [path.join(dir, 'src')],
        extraFiles: [path.join(dir, 'rules.txt')],
      },
      'userRef',
    );
    expect(result.totalHits).toBe(3);
    expect(Object.fromEntries(result.byFile)).toEqual({
      [path.join(dir, 'src', 'a.ts')]: 2,
      [path.join(dir, 'rules.txt')]: 1,
    });
  });

  it('reports an absent optional root, and stops on any other missing root or file', () => {
    const missing = path.join(dir, 'sibling');
    const base = { aliasSets, extraFiles: [] };
    expect(
      analyzeFieldLineage({ ...base, roots: [missing], optionalRoots: [missing] }, 'x')
        .skippedRoots,
    ).toEqual([missing]);
    expect(() => analyzeFieldLineage({ ...base, roots: [missing] }, 'x')).toThrow();
    expect(() =>
      analyzeFieldLineage({ ...base, roots: [], extraFiles: [path.join(dir, 'gone.rules')] }, 'x'),
    ).toThrow();
  });
});

describe('cleanup', () => {
  it('removes its targets that exist and leaves everything else', () => {
    put('build/out.js');
    put('keep.txt');
    runCleanup({ repoRoot: dir, targets: ['build', 'cache/absent'] });
    expect(existsSync(path.join(dir, 'build'))).toBe(false);
    expect(existsSync(path.join(dir, 'keep.txt'))).toBe(true);
  });

  it('refuses a target outside the repository', () => {
    const outside = path.join(dir, '..', `${path.basename(dir)}-outside.txt`);
    writeFileSync(outside, '');
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${String(code)}`);
    });
    try {
      expect(() =>
        runCleanup({ repoRoot: dir, targets: [`../${path.basename(outside)}`] }),
      ).toThrow('exit 1');
      expect(existsSync(outside)).toBe(true);
    } finally {
      rmSync(outside, { force: true });
    }
  });
});

describe('dev:login', () => {
  const plan = () =>
    devLoginPlan({
      repoRoot: dir,
      devProjectId: 'demo-dev',
      extraLogins: [{ name: 'Edge CLI', command: 'edge login', cwd: dir }],
    });

  it('forces every login, then points gcloud and ADC at the dev project', () => {
    expect(plan().logins.map((s) => s.command)).toEqual([
      'npx firebase login --reauth',
      'gcloud auth login --force',
      'gcloud auth application-default login',
      'edge login',
    ]);
    expect(plan().projectSetup.map((s) => s.command)).toEqual([
      'gcloud config set project demo-dev',
      'gcloud auth application-default set-quota-project demo-dev',
    ]);
  });

  it('runs every step in order and returns 0', () => {
    const p = plan();
    const ran: string[] = [];
    expect(runDevLogin(p, (step) => (ran.push(step.name), 0))).toBe(0);
    expect(ran).toHaveLength(p.logins.length + p.projectSetup.length + p.summary.length);
  });

  it('stops at the first failed login and returns its status', () => {
    const ran: string[] = [];
    expect(
      runDevLogin(plan(), (step) => (ran.push(step.name), step.name === 'gcloud CLI' ? 5 : 0)),
    ).toBe(5);
    expect(ran).toEqual(['Firebase CLI', 'gcloud CLI']);
  });

  it('looks for ADC where gcloud writes it, Windows first', () => {
    expect(adcCandidatePaths({ APPDATA: 'C:\\AppData' }, '/home/u')).toEqual([
      path.join('C:\\AppData', 'gcloud', 'application_default_credentials.json'),
      path.join('/home/u', '.config', 'gcloud', 'application_default_credentials.json'),
    ]);
    expect(adcCandidatePaths({}, '/home/u')).toHaveLength(1);
  });
});
