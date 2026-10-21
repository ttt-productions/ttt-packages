// The release gate and verdict: every selected component's job must have run and every unselected
// one must have been skipped — exactly, because a skipped job reports as success — and a stale or
// rollback-blocked run never finishes green, since a green run becomes the next release baseline.

import { describe, it, expect } from 'vitest';
import {
  assertReleaseVerdict,
  assertVerificationGate,
  renderSummary,
  type ReleaseVerdictConfig,
} from '../../src/node/tooling/release-verdict.js';

const CONFIG: ReleaseVerdictConfig = {
  components: [
    {
      key: 'worker',
      label: 'worker',
      selection: 'SELECT_WORKER',
      verifyResult: 'VERIFY_WORKER_RESULT',
      verifyJob: 'verify-worker',
      deploy: { dev: 'DEPLOY_WORKER_DEV', prod: 'DEPLOY_WORKER_PROD' },
    },
    {
      key: 'backend',
      label: 'backend',
      selection: 'SELECT_BACKEND',
      verifyResult: 'VERIFY_BACKEND_RESULT',
      verifyJob: 'verify-backend',
      deploy: { dev: 'DEPLOY_BACKEND_DEV', prod: 'DEPLOY_BACKEND_PROD' },
    },
  ],
  summaryFields: [{ label: 'Codebases', env: 'TARGETS' }],
};

const gateEnv = (over: Record<string, string> = {}) => ({
  RESOLVE_SCOPE_RESULT: 'success',
  EVENT_NAME: 'push',
  VALIDATE_DISPATCH_RESULT: 'skipped',
  SECURITY_AUDIT_RESULT: 'success',
  SELECT_WORKER: 'true',
  VERIFY_WORKER_RESULT: 'success',
  SELECT_BACKEND: 'false',
  VERIFY_BACKEND_RESULT: 'skipped',
  ...over,
});

const verdictEnv = (over: Record<string, string> = {}) => ({
  RELEASE_ENVIRONMENT: 'dev',
  GATE_RESULT: 'success',
  SELECT_WORKER: 'true',
  SELECT_BACKEND: 'false',
  DEPLOY_WORKER_DEV: 'success',
  DEPLOY_WORKER_PROD: 'skipped',
  DEPLOY_BACKEND_DEV: 'skipped',
  DEPLOY_BACKEND_PROD: 'skipped',
  ...over,
});

const codes = (blockers: { code: string }[]) => blockers.map((b) => b.code);

describe('verification gate', () => {
  it('passes a run whose selected jobs succeeded and unselected jobs were skipped', () => {
    expect(assertVerificationGate(CONFIG, gateEnv())).toEqual([]);
  });

  it('blocks a selected component whose verify job did not succeed, and an unselected one that ran', () => {
    expect(
      codes(assertVerificationGate(CONFIG, gateEnv({ VERIFY_WORKER_RESULT: 'skipped' }))),
    ).toEqual(['verify-not-success']);
    expect(
      codes(assertVerificationGate(CONFIG, gateEnv({ VERIFY_BACKEND_RESULT: 'success' }))),
    ).toEqual(['verify-not-skipped']);
  });

  it('pairs the dispatch validation exactly with the event', () => {
    expect(
      codes(assertVerificationGate(CONFIG, gateEnv({ VALIDATE_DISPATCH_RESULT: 'success' }))),
    ).toEqual(['dispatch-validation-unpaired']);
    expect(
      codes(
        assertVerificationGate(
          CONFIG,
          gateEnv({ EVENT_NAME: 'workflow_dispatch', VALIDATE_DISPATCH_RESULT: 'success' }),
        ),
      ),
    ).toEqual([]);
    expect(codes(assertVerificationGate(CONFIG, gateEnv({ EVENT_NAME: 'schedule' })))).toEqual([
      'dispatch-validation-unpaired',
    ]);
  });

  it('blocks a failed resolver, a failed audit, a stale run, and a tripped rollback guard', () => {
    expect(
      codes(
        assertVerificationGate(
          CONFIG,
          gateEnv({
            RESOLVE_SCOPE_RESULT: 'failure',
            SECURITY_AUDIT_RESULT: '',
            STALE: 'true',
            ROLLBACK_BLOCKED: 'true',
          }),
        ),
      ),
    ).toEqual(['resolver-failed', 'security-audit-failed', 'stale-run', 'rollback-blocked']);
  });
});

describe('release verdict', () => {
  it('passes when the active lane deployed exactly the selection and the other lane never ran', () => {
    expect(assertReleaseVerdict(CONFIG, verdictEnv())).toEqual([]);
  });

  it('blocks a selected component that was not released, and an unselected one that deployed', () => {
    expect(
      codes(assertReleaseVerdict(CONFIG, verdictEnv({ DEPLOY_WORKER_DEV: 'skipped' }))),
    ).toEqual(['deploy-not-success']);
    expect(
      codes(assertReleaseVerdict(CONFIG, verdictEnv({ DEPLOY_BACKEND_DEV: 'success' }))),
    ).toEqual(['deploy-not-skipped']);
  });

  it('blocks any run of the opposite environment', () => {
    expect(
      codes(assertReleaseVerdict(CONFIG, verdictEnv({ DEPLOY_BACKEND_PROD: 'success' }))),
    ).toEqual(['opposite-environment-ran']);
  });

  it('a stale or rollback-blocked run never finishes green, even with a green gate', () => {
    expect(codes(assertReleaseVerdict(CONFIG, verdictEnv({ STALE: 'true' })))).toEqual([
      'stale-run',
    ]);
    expect(codes(assertReleaseVerdict(CONFIG, verdictEnv({ ROLLBACK_BLOCKED: 'true' })))).toEqual([
      'rollback-blocked',
    ]);
  });

  it('refuses an unknown environment and a gate that did not succeed', () => {
    expect(
      codes(assertReleaseVerdict(CONFIG, verdictEnv({ RELEASE_ENVIRONMENT: 'staging' }))),
    ).toEqual(['unknown-environment']);
    expect(codes(assertReleaseVerdict(CONFIG, verdictEnv({ GATE_RESULT: 'failure' })))).toEqual([
      'gate-not-success',
    ]);
  });
});

describe('summary', () => {
  it("lists every component's selection, verify, and active-lane deploy, and the app's own fields", () => {
    const summary = renderSummary(CONFIG, {
      ...gateEnv(),
      ...verdictEnv(),
      TARGETS: 'functions:a',
    });
    expect(summary).toContain('- **Codebases:** functions:a');
    expect(summary).toContain('| worker | yes | success | success |');
    expect(summary).toContain('| backend | no | skipped | skipped |');
  });
});
