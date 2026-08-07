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

// App-injected product-specific patterns (the shape the app supplies at init).
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

// --- Firebase email-action one-time code (oobCode) ---------------------------
// A live bearer credential: whoever reads it can complete a password reset.
// Shape is Firebase's base64url output ([A-Za-z0-9_-], unpadded).
const FAKE_OOB = 'Xk9_aB-cD3efGHijkLMnop2qRsTuv';
const ACTION_ORIGIN = 'https://ttt.productions/auth/action';

describe('oobCode redaction (Firebase email-action one-time code)', () => {
  it('redacts oobCode while leaving origin, path, and mode readable', () => {
    const out = redactString(`${ACTION_ORIGIN}?mode=resetPassword&oobCode=${FAKE_OOB}`);
    expect(out).not.toContain(FAKE_OOB);
    expect(out).toContain(REDACTION_PLACEHOLDER);
    // The diagnostic value of the event must survive the redaction.
    expect(out).toContain('https://ttt.productions/auth/action');
    expect(out).toContain('mode=resetPassword');
  });

  it('terminates at & so following query params survive (oobCode first)', () => {
    const out = redactString(`${ACTION_ORIGIN}?oobCode=${FAKE_OOB}&mode=resetPassword&lang=en`);
    expect(out).not.toContain(FAKE_OOB);
    expect(out).toContain('mode=resetPassword');
    expect(out).toContain('lang=en');
  });

  it('redacts oobCode at end-of-string and in the &oobCode= position', () => {
    const out = redactString(`${ACTION_ORIGIN}?mode=verifyEmail&oobCode=${FAKE_OOB}`);
    expect(out).not.toContain(FAKE_OOB);
    expect(out).toContain('mode=verifyEmail');
  });

  it('is case-insensitive (oobcode, OOBCODE, oob_code)', () => {
    for (const key of ['oobcode', 'OOBCODE', 'oobCode', 'oob_code', 'oob-code']) {
      const out = redactString(`${ACTION_ORIGIN}?mode=signIn&${key}=${FAKE_OOB}&lang=en`);
      expect(out, `key: ${key}`).not.toContain(FAKE_OOB);
      expect(out, `key: ${key}`).toContain('lang=en');
    }
  });

  it('strips oobCode from request.url, breadcrumb navigation data, and contexts', () => {
    const url = `${ACTION_ORIGIN}?mode=resetPassword&oobCode=${FAKE_OOB}`;
    const event: ScrubbableEvent = {
      request: { url, headers: { referer: url } },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/login', to: url } },
        { category: 'navigation', data: { from: url, to: '/account' } },
      ],
      contexts: { page: { fullUrl: url } },
      extra: { replayUrl: url },
    };

    const out = createTelemetryScrubber({ patterns: TTT_PATTERNS })(event);

    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(FAKE_OOB);
    expect(serialized).toContain(REDACTION_PLACEHOLDER);
    // Route diagnostics survive.
    expect(serialized).toContain('/auth/action');
    expect(serialized).toContain('mode=resetPassword');
    expect(serialized).toContain('/account');
  });

  it('leaves an ordinary word containing "oob" untouched', () => {
    const ok = 'oobleck=fine and doobcode=notakey';
    expect(redactString(ok)).toBe(ok);
  });

  it('rides in the generic defaults, not the app-injected set', () => {
    const url = `${ACTION_ORIGIN}?mode=resetPassword&oobCode=${FAKE_OOB}`;

    // Defaults on (the app's real config) → redacted even alongside app patterns.
    const withDefaults: ScrubbableEvent = { message: url };
    redactEvent(withDefaults, { patterns: TTT_PATTERNS });
    expect(withDefaults.message).not.toContain(FAKE_OOB);

    // Defaults off → the app's own patterns do not cover it, proving ownership.
    const withoutDefaults: ScrubbableEvent = { message: url };
    redactEvent(withoutDefaults, { patterns: TTT_PATTERNS, includeDefaults: false });
    expect(withoutDefaults.message).toContain(FAKE_OOB);
  });
});

// --- OIDC / Firebase ID token carried as a URL parameter ---------------------
// Same defect class as oobCode: a credential-bearing query parameter the shared
// credential alternation cannot reach, because `\btoken\b` needs a word boundary
// that `idToken` (preceded by `d`) and `id_token` (preceded by `_`) both deny.
const FAKE_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1aWQtMTIzIn0.Xk9_aB-cD3efGH';

describe('id_token redaction (OIDC / Firebase ID token in a URL)', () => {
  it('redacts every spelling while leaving following params readable', () => {
    for (const key of ['id_token', 'idToken', 'id-token', 'ID_TOKEN']) {
      const out = redactString(`https://ttt.productions/cb?${key}=${FAKE_JWT}&state=abc`);
      expect(out, `key: ${key}`).not.toContain(FAKE_JWT);
      expect(out, `key: ${key}`).toContain(REDACTION_PLACEHOLDER);
      // The & terminator must hold for the hyphen spelling too — the shared
      // alternation reaches `id-token` and would swallow the rest of the query.
      expect(out, `key: ${key}`).toContain('state=abc');
    }
  });

  it('consumes a whole JWT (dots, hyphens, underscores) and stops at &', () => {
    const out = redactString(`https://ttt.productions/cb?id_token=${FAKE_JWT}&next=/account`);
    expect(out).toBe(`https://ttt.productions/cb?${REDACTION_PLACEHOLDER}&next=/account`);
  });

  it('redacts an id_token at end-of-string', () => {
    const out = redactString(`https://ttt.productions/cb?state=abc&id_token=${FAKE_JWT}`);
    expect(out).not.toContain(FAKE_JWT);
    expect(out).toContain('state=abc');
  });

  it('strips id_token from request.url and navigation breadcrumbs', () => {
    const url = `https://ttt.productions/cb?id_token=${FAKE_JWT}&state=abc`;
    const event: ScrubbableEvent = {
      request: { url },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: url } }],
    };
    const serialized = JSON.stringify(createTelemetryScrubber({ patterns: TTT_PATTERNS })(event));
    expect(serialized).not.toContain(FAKE_JWT);
    expect(serialized).toContain('state=abc');
  });

  it('leaves a plural/compound word containing "token" untouched', () => {
    const ok = 'counts: valid_tokens=12 invalid_tokens=3 tokenizer=lexer';
    expect(redactString(ok)).toBe(ok);
  });
});

// --- The compound-token class ------------------------------------------------
// `\btoken\b` in the shared alternation cannot reach ANY compound spelling —
// `authToken` (preceded by `d`/`h`) and `auth_token` (preceded by `_`) both deny
// the word boundary. Enumerating `access_token` / `refresh_token` / `id_token`
// one at a time is instance-patching; the dedicated pattern kills the class.
describe('compound token parameters (class kill)', () => {
  const COMPOUND_KEYS = [
    'authToken',
    'auth_token',
    'sessionToken',
    'session_token',
    'csrf_token',
    'xsrf_token',
    'userToken',
    'resetToken',
    'inviteToken',
    'verifyToken',
    'oauth_token',
  ];

  it('redacts every <prefix>token spelling while leaving following params readable', () => {
    for (const key of COMPOUND_KEYS) {
      const out = redactString(`https://ttt.productions/cb?${key}=${FAKE_JWT}&state=abc`);
      expect(out, `key: ${key}`).not.toContain(FAKE_JWT);
      expect(out, `key: ${key}`).toContain(REDACTION_PLACEHOLDER);
      expect(out, `key: ${key}`).toContain('state=abc');
    }
  });

  it('strips a compound token from request.url and navigation breadcrumbs', () => {
    const url = `https://ttt.productions/cb?sessionToken=${FAKE_JWT}&state=abc`;
    const event: ScrubbableEvent = {
      request: { url },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: url } }],
    };
    const serialized = JSON.stringify(createTelemetryScrubber({ patterns: TTT_PATTERNS })(event));
    expect(serialized).not.toContain(FAKE_JWT);
    expect(serialized).toContain('state=abc');
  });

  it('leaves plural, verb, and agent-noun forms of "token" untouched', () => {
    for (const ok of [
      'counts: valid_tokens=12 invalid_tokens=3',
      'tokenizer=lexerstage',
      'tokenize=truthy',
      'betokens=oldword',
    ]) {
      expect(redactString(ok), `control: ${ok}`).toBe(ok);
    }
  });

  // Pins WHY the shared alternation keeps its own token branches: the dedicated
  // pattern needs 4+ non-`&` chars, so a token whose value carries an early `&`
  // falls through to the greedy shared entry. Removing those entries as
  // "redundant" would silently reopen this hole.
  it('falls back to the greedy shared pattern when a token value contains an early &', () => {
    for (const probe of ['token=ab&cdef', 'access_token=xy&zzzz', 'refresh_token=a&bcdefgh']) {
      expect(redactString(probe), `probe: ${probe}`).toBe(REDACTION_PLACEHOLDER);
    }
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
