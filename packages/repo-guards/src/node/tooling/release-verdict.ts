// The release gate and verdict: the one implementation of selected <-> result pairing. Both answer
// "did every job whose selection said it must run actually run?", so both live here.
//
// The pairing is EXACT, never "success or skipped": a skipped job reports as success to a
// dependent's status check, so without an exact pair a selected deploy job that was unexpectedly
// skipped lets the run finish green, become the next last-green baseline, and permanently strand
// the component it claimed to release.
//
// Every input arrives as the step's environment; nothing here calls a provider or reads a
// credential.

export type ReleaseEnv = Readonly<Record<string, string | undefined>>;

export interface VerdictComponent {
  /** The scope output key (`backend`, `apphosting`, a Worker's key). */
  key: string;
  /** How the component is named in messages and the summary. */
  label: string;
  /** The env key carrying the component's selection (`true` / `false`). */
  selection: string;
  /** The env key carrying its verify job's result, and that job's name. */
  verifyResult: string;
  verifyJob: string;
  /** The env keys carrying its deploy job's result, per environment. */
  deploy: { dev: string; prod: string };
}

export interface ReleaseVerdictConfig {
  components: readonly VerdictComponent[];
  /** Extra summary lines an app reports, each a label and the env key it reads. */
  summaryFields?: readonly { label: string; env: string }[];
}

export interface Blocker {
  code: string;
  message: string;
}

const read = (env: ReleaseEnv, key: string): string => String(env[key] ?? '').trim();
const isSelected = (env: ReleaseEnv, key: string): boolean => read(env, key) === 'true';

/**
 * The verification gate's assertions; an empty list passes. They live in the required STEP, never
 * in a job `if:` — a false job-level condition marks the job skipped, which reports as success.
 */
export function assertVerificationGate(config: ReleaseVerdictConfig, env: ReleaseEnv): Blocker[] {
  const blockers: Blocker[] = [];
  const add = (code: string, message: string): void => {
    blockers.push({ code, message });
  };

  if (read(env, 'RESOLVE_SCOPE_RESULT') !== 'success') {
    add(
      'resolver-failed',
      `release scope could not be resolved (resolve-scope: ${read(env, 'RESOLVE_SCOPE_RESULT') || 'missing'}).`,
    );
  }

  const event = read(env, 'EVENT_NAME');
  const dispatchResult = read(env, 'VALIDATE_DISPATCH_RESULT');
  const expectedDispatch =
    event === 'workflow_dispatch' ? 'success' : event === 'push' ? 'skipped' : null;
  if (expectedDispatch === null) {
    add(
      'dispatch-validation-unpaired',
      `unexpected event '${event || 'missing'}' — this workflow releases on push and workflow_dispatch only.`,
    );
  } else if (dispatchResult !== expectedDispatch) {
    add(
      'dispatch-validation-unpaired',
      `event '${event}' requires validate-dispatch to be '${expectedDispatch}', got '${dispatchResult || 'missing'}'.`,
    );
  }

  if (read(env, 'SECURITY_AUDIT_RESULT') !== 'success') {
    add(
      'security-audit-failed',
      `security-audit is '${read(env, 'SECURITY_AUDIT_RESULT') || 'missing'}' (must be success).`,
    );
  }

  for (const component of config.components) {
    const selected = isSelected(env, component.selection);
    const result = read(env, component.verifyResult);
    if (selected && result !== 'success') {
      add(
        'verify-not-success',
        `${component.label} is selected, so ${component.verifyJob} must be 'success' — got '${result || 'missing'}'.`,
      );
    }
    if (!selected && result !== 'skipped') {
      add(
        'verify-not-skipped',
        `${component.label} is NOT selected, so ${component.verifyJob} must be 'skipped' — got '${result || 'missing'}'.`,
      );
    }
  }

  if (read(env, 'STALE') === 'true') {
    add(
      'stale-run',
      "this run's commit is an ancestor of a newer already-green head — the environment is already newer; refusing to deploy backward.",
    );
  }
  if (read(env, 'ROLLBACK_BLOCKED') === 'true') {
    add(
      'rollback-blocked',
      `a rollback guard tripped (reason: ${read(env, 'REASON') || 'unknown'}) — refusing to deploy at an unproven branch tip.`,
    );
  }

  return blockers;
}

/**
 * The release verdict: the required final fail-closed check. For the active environment, selected
 * means deploy `success` and unselected means deploy `skipped`; every opposite-environment deploy
 * must be `skipped`. A run is an eligible last-green baseline only when this passes.
 */
export function assertReleaseVerdict(config: ReleaseVerdictConfig, env: ReleaseEnv): Blocker[] {
  const blockers: Blocker[] = [];
  const add = (code: string, message: string): void => {
    blockers.push({ code, message });
  };

  const active = read(env, 'RELEASE_ENVIRONMENT');
  if (active !== 'dev' && active !== 'prod') {
    add(
      'unknown-environment',
      `RELEASE_ENVIRONMENT must be 'dev' or 'prod' — got '${active || 'missing'}'.`,
    );
    return blockers;
  }
  const other = active === 'dev' ? 'prod' : 'dev';

  if (read(env, 'GATE_RESULT') !== 'success') {
    add(
      'gate-not-success',
      `verification-gate is '${read(env, 'GATE_RESULT') || 'missing'}' (must be success before anything deploys).`,
    );
  }

  // Asserted here in their own right, not merely inherited through GATE_RESULT: a green run is
  // what becomes the next last-green baseline, so a stale or rollback-blocked run never finishes
  // green.
  if (read(env, 'STALE') === 'true') {
    add(
      'stale-run',
      "this run's commit is an ancestor of a newer already-green head — it must never become the next release baseline.",
    );
  }
  if (read(env, 'ROLLBACK_BLOCKED') === 'true') {
    add(
      'rollback-blocked',
      `a rollback guard tripped (reason: ${read(env, 'REASON') || 'unknown'}) — this run must never become the next release baseline.`,
    );
  }

  for (const component of config.components) {
    const selected = isSelected(env, component.selection);
    const activeResult = read(env, component.deploy[active]);
    const otherResult = read(env, component.deploy[other]);
    if (selected && activeResult !== 'success') {
      add(
        'deploy-not-success',
        `${component.label} was selected for release but its ${active} deploy is '${activeResult || 'missing'}' — the component was NOT released.`,
      );
    }
    if (!selected && activeResult !== 'skipped') {
      add(
        'deploy-not-skipped',
        `${component.label} was NOT selected but its ${active} deploy is '${activeResult || 'missing'}'.`,
      );
    }
    if (otherResult !== 'skipped') {
      add(
        'opposite-environment-ran',
        `${component.label}'s ${other} deploy is '${otherResult || 'missing'}' — only the ${active} lane may run on this branch.`,
      );
    }
  }

  return blockers;
}

const mark = (value: string): string =>
  value === 'success' ? 'success' : value === 'skipped' ? 'skipped' : value || '—';

/** The run summary for `GITHUB_STEP_SUMMARY`. No secrets, no credentials, no external calls. */
export function renderSummary(config: ReleaseVerdictConfig, env: ReleaseEnv): string {
  const active = read(env, 'RELEASE_ENVIRONMENT');
  const lines = [
    '## Release verdict',
    '',
    `- **Event:** ${read(env, 'EVENT_NAME') || '—'}`,
    `- **Branch / environment:** ${read(env, 'BRANCH') || '—'} → ${active || '—'}`,
    `- **Base SHA → head SHA:** ${read(env, 'BASE_SHA') || '(none)'} → ${read(env, 'HEAD_SHA') || '—'}`,
    `- **Scope reason:** \`${read(env, 'REASON') || '—'}\``,
    `- **full_fleet:** ${read(env, 'FULL_FLEET') || 'false'} · **stale:** ${read(env, 'STALE') || 'false'} · **rollback_blocked:** ${read(env, 'ROLLBACK_BLOCKED') || 'false'}`,
    ...(config.summaryFields ?? []).map(
      (field) => `- **${field.label}:** ${read(env, field.env) || '—'}`,
    ),
    '',
    '| Component | Selected | Verified | Deployed |',
    '| --- | --- | --- | --- |',
  ];
  for (const component of config.components) {
    const selected = isSelected(env, component.selection);
    const deployKey = active === 'prod' ? component.deploy.prod : component.deploy.dev;
    lines.push(
      `| ${component.label} | ${selected ? 'yes' : 'no'} | ${mark(read(env, component.verifyResult))} | ${mark(read(env, deployKey))} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
