export const RELEASE_REASONS = Object.freeze({
  NO_GREEN_BASELINE: 'no-green-baseline',
  API_ERROR: 'api-error',
  UNREACHABLE_BASELINE: 'unreachable-baseline',
  DIVERGENT_HISTORY: 'divergent-history',
  CONTROL_FILE_CHANGE: 'control-file-change',
  STALE_RUN: 'stale-run',
  BRANCH_ADVANCED: 'branch-advanced',
  BRANCH_TIP_UNPROVABLE: 'branch-tip-unprovable',
  DISPATCH_SAFETY_UNPROVABLE: 'dispatch-safety-unprovable',
  MANUAL_DISPATCH: 'manual-dispatch',
  OK: 'ok',
} as const);

export type ReleaseReason = (typeof RELEASE_REASONS)[keyof typeof RELEASE_REASONS];

export const RELEASE_REASON_CODES: readonly ReleaseReason[] = Object.freeze(
  Object.values(RELEASE_REASONS),
);

export interface ReleaseComponent {
  key: string;
  pathPrefixes?: readonly string[];
  exactPaths?: readonly string[];
  everyPush?: boolean;
  dispatchByCodebases?: boolean;
}

export interface ReleaseScopeConfig {
  components: readonly ReleaseComponent[];
  controlPaths: readonly string[];
}

export interface ReleaseApi {
  branchTip(): Promise<string | null | undefined>;
  latestGreenPushSha(): Promise<string | null | undefined>;
}

export interface ReleaseGit {
  commitExists(sha: string): boolean;
  // Git's own semantics: `isAncestor(a, a)` is true.
  isAncestor(a: string, b: string): boolean;
  changedFiles(base: string, head: string): string[];
}

export interface ReleaseDispatch {
  full_fleet?: boolean;
  codebases?: string;
  [componentKey: string]: boolean | string | undefined;
}

export type ResolvedScope = {
  base_sha: string;
  stale: boolean;
  rollback_blocked: boolean;
  full_fleet: boolean;
  reason: ReleaseReason;
} & Record<string, string | boolean>;

export class DispatchInputError extends Error {}

const SHA_RE = /^[0-9a-f]{40}$/;
const isUsableSha = (value: unknown): value is string =>
  typeof value === 'string' && SHA_RE.test(value.trim());
const describeError = (error: unknown): string =>
  String(error instanceof Error ? error.message : error);

export function parseCodebasesInput(
  raw: unknown,
  validNames: readonly string[],
): { kind: 'none' | 'all' | 'list'; names: string[] } {
  const value = String(raw ?? '').trim();
  if (value === '' || value === 'none') return { kind: 'none', names: [] };
  if (value === 'all') return { kind: 'all', names: [...validNames] };
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*(?:,[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/.test(value)) {
    throw new DispatchInputError(
      'codebases must be "none", "all", or a comma-separated list of codebase names',
    );
  }
  const names = value.split(',');
  const unknown = names.filter((n) => !validNames.includes(n));
  if (unknown.length) throw new DispatchInputError(`unknown codebase(s): ${unknown.join(', ')}`);
  return { kind: 'list', names };
}

export function classifyPaths(
  config: ReleaseScopeConfig,
  files: readonly string[],
): Record<string, boolean> & { control: boolean } {
  const result: Record<string, boolean> & { control: boolean } = { control: false };
  for (const component of config.components) {
    if (!component.everyPush) result[component.key] = false;
  }
  for (const file of files) {
    if (config.controlPaths.includes(file)) result.control = true;
    for (const component of config.components) {
      if (component.everyPush) continue;
      if (
        component.pathPrefixes?.some((prefix) => file.startsWith(prefix)) ||
        component.exactPaths?.includes(file)
      ) {
        result[component.key] = true;
      }
    }
  }
  return result;
}

export function outputKeys(config: ReleaseScopeConfig): string[] {
  return [
    'base_sha',
    'stale',
    'rollback_blocked',
    'full_fleet',
    ...config.components.map((c) => c.key),
    'reason',
  ];
}

export async function resolveReleaseScope(
  config: ReleaseScopeConfig,
  {
    event,
    headSha,
    dispatch = {},
    codebaseNames = [],
    api,
    git,
  }: {
    event: string;
    headSha: string;
    dispatch?: ReleaseDispatch;
    codebaseNames?: readonly string[];
    api: ReleaseApi;
    git: ReleaseGit;
  },
): Promise<ResolvedScope> {
  const scope = (overrides: Partial<ResolvedScope>): ResolvedScope => {
    const selection: Record<string, boolean> = {};
    for (const component of config.components) selection[component.key] = false;
    return {
      base_sha: '',
      stale: false,
      rollback_blocked: false,
      full_fleet: false,
      ...selection,
      reason: RELEASE_REASONS.OK,
      ...overrides,
    } as ResolvedScope;
  };
  const fullFleet = (reason: ReleaseReason, extra: Partial<ResolvedScope> = {}): ResolvedScope => {
    const all: Record<string, boolean> = {};
    for (const component of config.components) all[component.key] = true;
    return scope({ full_fleet: true, ...all, reason, ...extra });
  };

  const isDispatch = event === 'workflow_dispatch';

  let codebases: { kind: string; names: string[] } = { kind: 'none', names: [] };
  if (isDispatch && config.components.some((c) => c.dispatchByCodebases)) {
    codebases = parseCodebasesInput(dispatch.codebases, codebaseNames);
  }

  // A release queue runs waiting runs in no guaranteed order, so an older run can execute after a
  // newer one.
  let tip: string | null | undefined;
  try {
    tip = await api.branchTip();
  } catch (error) {
    console.error(`release-scope: branch-tip lookup failed: ${describeError(error)}`);
    return scope({ rollback_blocked: true, reason: RELEASE_REASONS.BRANCH_TIP_UNPROVABLE });
  }
  if (!isUsableSha(tip)) {
    console.error('release-scope: branch-tip lookup returned no usable SHA');
    return scope({ rollback_blocked: true, reason: RELEASE_REASONS.BRANCH_TIP_UNPROVABLE });
  }
  if (tip.trim() !== headSha) {
    console.error(`release-scope: branch tip ${tip.trim()} is ahead of this run's ${headSha}`);
    return scope({ rollback_blocked: true, reason: RELEASE_REASONS.BRANCH_ADVANCED });
  }

  let candidate: string | null | undefined = null;
  let lookupFailed = false;
  try {
    candidate = await api.latestGreenPushSha();
  } catch (error) {
    console.error(`release-scope: last-green lookup failed: ${describeError(error)}`);
    lookupFailed = true;
  }

  if (isDispatch) {
    if (lookupFailed) {
      return scope({ rollback_blocked: true, reason: RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE });
    }
    if (candidate) {
      if (!git.commitExists(candidate)) {
        console.error(
          `release-scope: newest green SHA ${candidate} is not reachable in this checkout`,
        );
        return scope({
          rollback_blocked: true,
          reason: RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE,
        });
      }
      if (candidate !== headSha) {
        // STRICT ancestry only: a dispatch AT the current released commit is the legitimate
        // manual redeploy and stays allowed.
        if (git.isAncestor(headSha, candidate)) {
          return scope({ stale: true, reason: RELEASE_REASONS.STALE_RUN });
        }
        if (!git.isAncestor(candidate, headSha)) {
          console.error(
            'release-scope: dispatch commit and newest green commit have divergent history',
          );
          return scope({
            rollback_blocked: true,
            reason: RELEASE_REASONS.DISPATCH_SAFETY_UNPROVABLE,
          });
        }
      }
    }
    if (dispatch.full_fleet === true) return fullFleet(RELEASE_REASONS.MANUAL_DISPATCH);
    const selection: Record<string, boolean> = {};
    for (const component of config.components) {
      selection[component.key] = component.dispatchByCodebases
        ? codebases.kind !== 'none'
        : dispatch[component.key] === true;
    }
    return scope({ ...selection, reason: RELEASE_REASONS.MANUAL_DISPATCH });
  }

  if (lookupFailed) return fullFleet(RELEASE_REASONS.API_ERROR);
  if (!candidate) return fullFleet(RELEASE_REASONS.NO_GREEN_BASELINE);
  if (!git.commitExists(candidate)) {
    // No backward scan for an older success: after a force push the environment was deployed from
    // this newest, now unreachable, green commit.
    console.error(`release-scope: newest green SHA ${candidate} is not reachable in this checkout`);
    return fullFleet(RELEASE_REASONS.UNREACHABLE_BASELINE);
  }
  if (!git.isAncestor(candidate, headSha)) {
    if (git.isAncestor(headSha, candidate)) {
      return scope({ stale: true, reason: RELEASE_REASONS.STALE_RUN });
    }
    console.error('release-scope: this commit and the newest green commit have divergent history');
    return fullFleet(RELEASE_REASONS.DIVERGENT_HISTORY);
  }

  let changed: string[];
  try {
    changed = git.changedFiles(candidate, headSha);
  } catch (error) {
    console.error(`release-scope: diff against ${candidate} failed: ${describeError(error)}`);
    return fullFleet(RELEASE_REASONS.UNREACHABLE_BASELINE, { base_sha: candidate });
  }

  const hits = classifyPaths(config, changed);
  if (hits.control) {
    return fullFleet(RELEASE_REASONS.CONTROL_FILE_CHANGE, { base_sha: candidate });
  }
  const selection: Record<string, boolean> = {};
  for (const component of config.components) {
    selection[component.key] = component.everyPush === true || hits[component.key] === true;
  }
  return scope({ base_sha: candidate, ...selection, reason: RELEASE_REASONS.OK });
}

export function formatOutputs(config: ReleaseScopeConfig, resolved: ResolvedScope): string {
  return outputKeys(config)
    .map((key) => `${key}=${String(resolved[key])}`)
    .join('\n');
}

export function lastGreenRunsUrl(repo: string, branch: string, workflowFile: string): string {
  return (
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs` +
    `?event=push&status=success&branch=${encodeURIComponent(branch)}&per_page=20`
  );
}

export function pickNewestGreenSha(
  runs: readonly { id: string | number; head_sha: string }[] | null | undefined,
  currentRunId: string | number,
): string | null {
  const newest = (runs ?? []).find((r) => String(r.id) !== String(currentRunId));
  return newest ? newest.head_sha : null;
}
