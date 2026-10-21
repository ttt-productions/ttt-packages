// The release-scope resolver: the one owner of what a release run deploys.
//
// Scope is diffed against the head SHA of the last successful PUSH run of the release workflow on
// the same branch (the "last-green baseline"), never the push's own `before`, so a failed run's
// changes roll into the next green run instead of vanishing from the next push's diff.
//
// Two rollback guards run BEFORE anything is selected, on both events, because a release queue
// runs waiting runs in no guaranteed order, so an older run can execute after a newer one:
//   - branch tip — this run's SHA must still be the live branch tip; an unprovable tip fails
//     CLOSED (never the full-release fallback: a full release at an unproven tip could roll back a
//     newer partial deploy).
//   - stale green — this run's commit must not be a STRICT ancestor of the newest green head
//     (catches stale history even when the tip was moved or force-pushed back).
//
// `stale` and `rollback_blocked` are distinct outputs wired resolver -> gate -> verdict; a reason
// string or log line is never control flow. `reason` is a fixed code — raw exception, API, and git
// text goes to the log only.

/** The fixed reason codes. A reason is a CODE, never a message: nothing untrusted reaches it. */
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

/** One deployable component of an app's release. */
export interface ReleaseComponent {
  /** The output key (`backend`, `apphosting`, a Worker's key). */
  key: string;
  /** A changed path under one of these folders selects the component on a push. */
  pathPrefixes?: readonly string[];
  /** A changed path equal to one of these selects the component on a push. */
  exactPaths?: readonly string[];
  /** Selected on every push, whatever changed (the frontend rollout). */
  everyPush?: boolean;
  /**
   * A manual dispatch selects this component from the validated `codebases` input instead of a
   * true/false flag: any codebase selection but `none` selects it.
   */
  dispatchByCodebases?: boolean;
}

export interface ReleaseScopeConfig {
  components: readonly ReleaseComponent[];
  /** Files that govern the release itself: a change to any forces a full release. */
  controlPaths: readonly string[];
}

export interface ReleaseApi {
  branchTip(): Promise<string | null | undefined>;
  latestGreenPushSha(): Promise<string | null | undefined>;
}

export interface ReleaseGit {
  commitExists(sha: string): boolean;
  /** Git's own semantics: `isAncestor(a, a)` is true. */
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

/** Thrown for an invalid `codebases` dispatch input, before ANY git or API call runs. */
export class DispatchInputError extends Error {}

const SHA_RE = /^[0-9a-f]{40}$/;
const isUsableSha = (value: unknown): value is string =>
  typeof value === 'string' && SHA_RE.test(value.trim());
const describeError = (error: unknown): string =>
  String(error instanceof Error ? error.message : error);

/**
 * The manual `codebases` input: `none`, `all`, or an explicit list of known codebase names.
 * Anything else — quoting, command substitution, whitespace, newlines, unknown names — throws, so
 * an adversarial value never reaches a shell, a git call, or a deploy target.
 */
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

/** Which components a set of changed paths selects, and whether any is a control path. */
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

/** The ordered output keys of a resolved scope. */
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

/**
 * Resolve the release scope. `api` and `git` are injected so the decision logic is testable with
 * no network and no repository.
 */
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

  // Dispatch input is validated FIRST: an adversarial value is rejected before any git command,
  // API call, or output is produced.
  let codebases: { kind: string; names: string[] } = { kind: 'none', names: [] };
  if (isDispatch && config.components.some((c) => c.dispatchByCodebases)) {
    codebases = parseCodebasesInput(dispatch.codebases, codebaseNames);
  }

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

  // The newest green PUSH run's head SHA: the baseline candidate and the stale-green guard.
  let candidate: string | null | undefined = null;
  let lookupFailed = false;
  try {
    candidate = await api.latestGreenPushSha();
  } catch (error) {
    console.error(`release-scope: last-green lookup failed: ${describeError(error)}`);
    lookupFailed = true;
  }

  if (isDispatch) {
    // A dispatch safety-lookup failure, an unreachable newest-green SHA, or divergent history
    // fails CLOSED: it must never turn an old manual commit into a full release.
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
    // No green baseline at all is allowed here only because the tip guard already proved this
    // SHA is still the branch tip.
    if (dispatch.full_fleet === true) return fullFleet(RELEASE_REASONS.MANUAL_DISPATCH);
    const selection: Record<string, boolean> = {};
    for (const component of config.components) {
      selection[component.key] = component.dispatchByCodebases
        ? codebases.kind !== 'none'
        : dispatch[component.key] === true;
    }
    return scope({ ...selection, reason: RELEASE_REASONS.MANUAL_DISPATCH });
  }

  // Push. Tip equality is proven, so an ordinary last-green lookup failure may safely select the
  // full release: the one safe full-release fallback.
  if (lookupFailed) return fullFleet(RELEASE_REASONS.API_ERROR);
  if (!candidate) return fullFleet(RELEASE_REASONS.NO_GREEN_BASELINE);
  if (!git.commitExists(candidate)) {
    // Deliberately NOT a backward scan for an older reachable success: after a force push the
    // environment was deployed from that newest (now unreachable) green commit, so diffing
    // against anything older would under-classify the release.
    console.error(`release-scope: newest green SHA ${candidate} is not reachable in this checkout`);
    return fullFleet(RELEASE_REASONS.UNREACHABLE_BASELINE);
  }
  if (!git.isAncestor(candidate, headSha)) {
    // `isAncestor(a, a)` is true, so here the candidate is neither an ancestor nor equal: this run
    // is behind the newest green head, or history diverged.
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
    // A component selected on every push is selected here so no downstream job re-derives it
    // from event conditions: the resolver is the one owner of release selection.
    selection[component.key] = component.everyPush === true || hits[component.key] === true;
  }
  return scope({ base_sha: candidate, ...selection, reason: RELEASE_REASONS.OK });
}

/** `GITHUB_OUTPUT` lines in the fixed key order; booleans are emitted as `true` / `false`. */
export function formatOutputs(config: ReleaseScopeConfig, resolved: ResolvedScope): string {
  return outputKeys(config)
    .map((key) => `${key}=${String(resolved[key])}`)
    .join('\n');
}

/**
 * The last-green lookup query. `event=push` keeps a successful manual DISPATCH from ever becoming
 * a diff baseline; `status=success` and the branch filter do the rest.
 */
export function lastGreenRunsUrl(repo: string, branch: string, workflowFile: string): string {
  return (
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs` +
    `?event=push&status=success&branch=${encodeURIComponent(branch)}&per_page=20`
  );
}

/**
 * The newest green run by GitHub's own run ordering, excluding THIS run. Deliberately no backward
 * scan for an older success (see the unreachable-baseline rule above).
 */
export function pickNewestGreenSha(
  runs: readonly { id: string | number; head_sha: string }[] | null | undefined,
  currentRunId: string | number,
): string | null {
  const newest = (runs ?? []).find((r) => String(r.id) !== String(currentRunId));
  return newest ? newest.head_sha : null;
}
