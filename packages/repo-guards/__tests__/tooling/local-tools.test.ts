// The local-stack tools: dev:kill matches only this repository's stack processes, by the app's
// signatures and repository markers; the playbook check finds every cited file that
// is gone; field lineage counts every alias; cleanup deletes only its fixed targets; and dev:login
// stops at the first failed step.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCleanup } from '../../src/node/tooling/cleanup.js';
import { adcCandidatePaths, devLoginPlan, runDevLogin } from '../../src/node/tooling/dev-login.js';
import { isStackProcess, killDevStack, listeningOn } from '../../src/node/tooling/dev-stack.js';
import { analyzeFieldLineage } from '../../src/node/tooling/field-lineage.js';
import { checkPlaybookRefs } from '../../src/node/tooling/playbook-refs.js';

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
  const config = () => ({
    repoRoot: dir,
    playbooksDir: 'docs/playbooks',
    pathPrefixes: ['src', '.github'],
    rootFiles: ['package.json'],
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
    const { checked, misses } = checkPlaybookRefs(config());
    expect(checked).toBe(4);
    expect(misses).toEqual([
      { file: 'docs/playbooks/audit.md', line: 1, token: 'src/gone.ts' },
      { file: 'docs/playbooks/audit.md', line: 2, token: '.github/workflows/missing.yml' },
    ]);
  });

  it('strips every line-anchor form before checking the path', () => {
    put('src/real.ts');
    put(
      'docs/playbooks/a.md',
      '`src/real.ts#L4-L9` `src/real.ts#L12` `src/real.ts:4-9` `src/real.ts:12:3` `src/gone.ts#L2`',
    );
    expect(checkPlaybookRefs(config())).toEqual({
      checked: 2,
      misses: [{ file: 'docs/playbooks/a.md', line: 1, token: 'src/gone.ts' }],
    });
  });

  it('a folder is not a file reference that exists', () => {
    mkdirSync(path.join(dir, 'src', 'folder.d'), { recursive: true });
    put('docs/playbooks/a.md', '`src/folder.d`');
    expect(checkPlaybookRefs(config()).misses).toEqual([
      { file: 'docs/playbooks/a.md', line: 1, token: 'src/folder.d' },
    ]);
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
