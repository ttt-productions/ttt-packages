// TTT_FORBIDDEN_TELEMETRY_PATTERNS — the app-injected half of the telemetry scrubber.
//
// The consuming app minimizes its OWN Sentry emit points by construction (evidence keys and
// statutory request ids stay in Cloud Logging, the operator-only triage surface). This pattern set
// is the defense-in-depth layer under that: it catches the identifiers an app emit point never
// wrote — above all a THIRD-PARTY error message that embeds the document path it failed on.
//
// The module is deliberately dependency-free (entries are `RegExp | string`, structurally identical
// to monitoring-core's `ForbiddenPattern`), so these tests exercise the patterns directly the way
// monitoring-core's `redactString` applies them: global replace, each pattern in turn.

import { describe, it, expect } from 'vitest';
import { TTT_FORBIDDEN_TELEMETRY_PATTERNS, EVIDENCE_BUCKET_HOSTS } from '../src/constants/safety-telemetry-patterns';

const PLACEHOLDER = '[REDACTED]';

/** Apply every pattern the way monitoring-core's scrubber does. */
function redact(value: string): string {
  let out = value;
  for (const pattern of TTT_FORBIDDEN_TELEMETRY_PATTERNS) {
    if (typeof pattern === 'string') {
      out = out.split(pattern).join(PLACEHOLDER);
      continue;
    }
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    out = out.replace(new RegExp(pattern.source, flags), PLACEHOLDER);
  }
  return out;
}

describe('restricted safety document paths', () => {
  // The exact shape a Firestore NOT_FOUND / failed-precondition names when the deadline
  // escalation transaction fails — the leak path an app emit point cannot minimize.
  const MONITOR_ID = 'req_9f8e7d6c5b4a__nciiRemovalDeadline';

  it('redacts a removal-deadline monitor path out of a third-party error message', () => {
    const message = `5 NOT_FOUND: no entity to update: path { type: "safetySlaMonitors/${MONITOR_ID}" }`;
    const scrubbed = redact(message);
    expect(scrubbed).not.toContain(MONITOR_ID);
    expect(scrubbed).not.toContain('safetySlaMonitors/');
    expect(scrubbed).toContain(PLACEHOLDER);
  });

  it('redacts a take-it-down request path (the statutory request id)', () => {
    const scrubbed = redact('GET takeItDownRequests/req_9f8e7d6c5b4a failed 403');
    expect(scrubbed).not.toContain('req_9f8e7d6c5b4a');
    expect(scrubbed).not.toContain('takeItDownRequests/');
  });

  it('leaves the bare collection names (no id) readable — the operator still sees WHAT failed', () => {
    // Low collateral: the pattern requires a path separator + a segment, so prose naming the
    // collection is untouched.
    expect(redact('the safetySlaMonitors sweep failed')).toBe('the safetySlaMonitors sweep failed');
    expect(redact('takeItDownRequests is empty')).toBe('takeItDownRequests is empty');
  });
});

describe('evidence identifiers (regression cover for the existing set)', () => {
  it('redacts evidence object keys, vault keys, and bucket URLs', () => {
    expect(redact('nciiEvidence/req_1/file_2')).not.toContain('nciiEvidence/');
    expect(redact('nciiAuthorityEvidence/resv_1/proof')).not.toContain('nciiAuthorityEvidence/');
    expect(redact(`evidence/case_42/${'0'.repeat(32)}`)).not.toContain('evidence/case_42');
    for (const host of EVIDENCE_BUCKET_HOSTS) {
      expect(redact(`https://${host}/o/x`)).not.toContain(host);
    }
  });

  it('redacts a 64-hex detector hash and leaves ordinary error text alone', () => {
    expect(redact(`hash ${'a'.repeat(64)}`)).not.toContain('a'.repeat(64));
    expect(redact('TypeError: cannot read property foo of undefined')).toBe(
      'TypeError: cannot read property foo of undefined',
    );
  });
});
