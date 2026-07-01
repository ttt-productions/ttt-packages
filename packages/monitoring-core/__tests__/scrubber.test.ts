import { describe, it, expect } from 'vitest';
import {
  createTelemetryScrubber,
  redactEvent,
  redactString,
  REDACTION_PLACEHOLDER,
  DEFAULT_FORBIDDEN_PATTERNS,
  type ScrubbableEvent,
} from '../src/scrubber';

// --- Synthetic FORBIDDEN canary values (all fake — never real) ---------------
const FAKE_EVIDENCE_URL =
  'https://storage.googleapis.com/ttt-prod-ncii-evidence/case_9f/abcd1234';
const FAKE_EVIDENCE_PREFIX = 'https://storage.googleapis.com/ttt-prod-ncii-evidence/';
const FAKE_IPV4 = '203.0.113.42';
const FAKE_IPV6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
const FAKE_DETECTOR_HASH = 'a'.repeat(64); // 64 hex chars — detector-hash shape
const FAKE_NCMEC_CRED = 'ncmec-key-abcdef0123456789';
const FAKE_BEARER = 'Bearer sk_live_abcdef0123456789ABCDEF';

// App-injected TTT-specific patterns (the shape the app supplies at init).
const TTT_PATTERNS = [
  FAKE_EVIDENCE_PREFIX, // literal string prefix
  /\bncmec-[a-z]+-[a-z0-9]{16,}\b/gi, // NCMEC credential marker
  /\b[a-f0-9]{64}\b/gi, // detector-hash shape (64 hex)
];

const ALL_CANARIES = [
  FAKE_EVIDENCE_URL,
  FAKE_EVIDENCE_PREFIX,
  FAKE_IPV4,
  FAKE_IPV6,
  FAKE_DETECTOR_HASH,
  FAKE_NCMEC_CRED,
];

function assertNoCanariesSurvive(event: unknown) {
  const serialized = JSON.stringify(event);
  for (const canary of ALL_CANARIES) {
    expect(serialized).not.toContain(canary);
  }
}

describe('redactString (generic defaults)', () => {
  it('redacts a full IPv4 address', () => {
    expect(redactString(`from ${FAKE_IPV4} ok`)).toBe(`from ${REDACTION_PLACEHOLDER} ok`);
  });

  it('redacts a full IPv6 address', () => {
    expect(redactString(FAKE_IPV6)).toBe(REDACTION_PLACEHOLDER);
  });

  it('redacts a compressed IPv6 address', () => {
    const out = redactString('peer fe80::1ff:fe23:4567:890a here');
    expect(out).not.toContain('fe80::1ff:fe23:4567:890a');
    expect(out).toContain(REDACTION_PLACEHOLDER);
  });

  it('redacts a bearer token', () => {
    expect(redactString(`auth ${FAKE_BEARER}`)).not.toContain('sk_live');
  });

  it('redacts a generic credential assignment', () => {
    expect(redactString('password=hunter2secret')).not.toContain('hunter2secret');
    expect(redactString('api_key: "abc12345"')).not.toContain('abc12345');
  });

  it('leaves ordinary text untouched', () => {
    const ok = 'processing case case_123 phase quarantine';
    expect(redactString(ok)).toBe(ok);
  });

  it('does not mutate a caller-owned RegExp lastIndex across calls', () => {
    const re = DEFAULT_FORBIDDEN_PATTERNS[0];
    redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`);
    redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`);
    // Second call must redact both occurrences (no stale lastIndex leak).
    expect(re.lastIndex).toBeTypeOf('number');
    expect(redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`)).toBe(
      `${REDACTION_PLACEHOLDER} and ${REDACTION_PLACEHOLDER}`
    );
  });
});

describe('createTelemetryScrubber — CANARY test', () => {
  const scrub = createTelemetryScrubber({ patterns: TTT_PATTERNS });

  it('strips every forbidden canary from message, extra, breadcrumbs, and nested contexts', () => {
    const event: ScrubbableEvent = {
      message: `error handling ${FAKE_EVIDENCE_URL} from ${FAKE_IPV4}`,
      exception: {
        values: [
          {
            type: 'Error',
            value: `NCMEC cred leaked: ${FAKE_NCMEC_CRED}`,
            stacktrace: {
              frames: [
                {
                  filename: 'safety.ts',
                  vars: { hash: FAKE_DETECTOR_HASH, ip: FAKE_IPV6 },
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        {
          category: 'safety',
          message: `uploaded to ${FAKE_EVIDENCE_URL}`,
          data: { reporterIp: FAKE_IPV4, ncmec: FAKE_NCMEC_CRED },
        },
      ],
      extra: {
        detectorHash: FAKE_DETECTOR_HASH,
        nested: { deep: { evidence: FAKE_EVIDENCE_URL, list: [FAKE_IPV6, 'fine'] } },
      },
      contexts: {
        safety: {
          case: {
            evidenceUrl: FAKE_EVIDENCE_URL,
            reporterIp: FAKE_IPV4,
            detectorHash: FAKE_DETECTOR_HASH,
          },
        },
      },
      tags: { peer: FAKE_IPV4 },
      request: {
        url: FAKE_EVIDENCE_URL,
        headers: { authorization: FAKE_BEARER, 'x-forwarded-for': FAKE_IPV4 },
      },
      user: { ip_address: FAKE_IPV4, id: 'uid-123' },
    };

    const scrubbed = scrub(event);

    expect(scrubbed).not.toBeNull();
    assertNoCanariesSurvive(scrubbed);

    // Sanity: the placeholder actually landed and safe fields survived.
    const serialized = JSON.stringify(scrubbed);
    expect(serialized).toContain(REDACTION_PLACEHOLDER);
    expect(serialized).toContain('uid-123');
    expect(serialized).toContain('safety');
  });

  it('mutates in place and returns the same event object', () => {
    const event: ScrubbableEvent = { message: `ip ${FAKE_IPV4}` };
    const out = scrub(event);
    expect(out).toBe(event);
    expect((out as ScrubbableEvent).message).toBe(`ip ${REDACTION_PLACEHOLDER}`);
  });

  it('handles cyclic references without infinite recursion', () => {
    const cyclic: Record<string, unknown> = { ip: FAKE_IPV4 };
    cyclic.self = cyclic;
    const event: ScrubbableEvent = { extra: cyclic };
    expect(() => scrub(event)).not.toThrow();
    expect((event.extra as Record<string, unknown>).ip).toBe(REDACTION_PLACEHOLDER);
  });

  it('returns null-ish input unchanged (never throws)', () => {
    expect(scrub(null as unknown as ScrubbableEvent)).toBeNull();
  });

  it('works with only default patterns (no app patterns supplied)', () => {
    const defaultScrub = createTelemetryScrubber();
    const event: ScrubbableEvent = { message: `peer ${FAKE_IPV4}`, extra: { ip6: FAKE_IPV6 } };
    const out = defaultScrub(event) as ScrubbableEvent;
    expect(JSON.stringify(out)).not.toContain(FAKE_IPV4);
    expect(JSON.stringify(out)).not.toContain(FAKE_IPV6);
  });
});

describe('redactEvent — direct backend use', () => {
  it('scrubs an event object for the withScope / manual-capture path', () => {
    const event: ScrubbableEvent = {
      message: `denied serving for ${FAKE_EVIDENCE_URL}`,
      extra: { hash: FAKE_DETECTOR_HASH },
    };
    redactEvent(event, { patterns: TTT_PATTERNS });
    assertNoCanariesSurvive(event);
  });

  it('can exclude generic defaults when includeDefaults is false', () => {
    const event: ScrubbableEvent = { message: `ip ${FAKE_IPV4} hash ${FAKE_DETECTOR_HASH}` };
    redactEvent(event, { patterns: TTT_PATTERNS, includeDefaults: false });
    // Default IPv4 pattern is off → the IP survives, but the app hash pattern still fires.
    expect(event.message).toContain(FAKE_IPV4);
    expect(event.message).not.toContain(FAKE_DETECTOR_HASH);
  });
});
