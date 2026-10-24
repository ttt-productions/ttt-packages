import { describe, it, expect } from 'vitest';
import {
  createTelemetryScrubber,
  redactEvent,
  redactString,
  REDACTION_PLACEHOLDER,
  DEFAULT_FORBIDDEN_PATTERNS,
  type ScrubbableEvent,
} from '../src/scrubber.js';

const FAKE_PRIVATE_URL = 'https://storage.example.test/private-bucket/item_9f/abcd1234';
const FAKE_PRIVATE_PREFIX = 'https://storage.example.test/private-bucket/';
const FAKE_IPV4 = '203.0.113.42';
const FAKE_IPV6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
const FAKE_DIGEST = '0123456789abcdef'.repeat(4);
const FAKE_VENDOR_KEY = 'vendorx-key-abcdef0123456789';
const FAKE_BEARER = 'Bearer sk_live_abcdef0123456789ABCDEF';

const APP_PATTERNS = [
  FAKE_PRIVATE_PREFIX,
  /\bvendorx-[a-z]+-[a-z0-9]{16,}\b/gi,
  /\b[a-f0-9]{64}\b/gi,
];

const ALL_CANARIES = [
  FAKE_PRIVATE_URL,
  FAKE_PRIVATE_PREFIX,
  FAKE_IPV4,
  FAKE_IPV6,
  FAKE_DIGEST,
  FAKE_VENDOR_KEY,
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
    const ok = 'processing case case_123 phase review';
    expect(redactString(ok)).toBe(ok);
  });

  it('does not mutate a caller-owned RegExp lastIndex across calls', () => {
    const re = DEFAULT_FORBIDDEN_PATTERNS[0];
    redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`);
    redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`);
    expect(re.lastIndex).toBeTypeOf('number');
    expect(redactString(`${FAKE_IPV4} and ${FAKE_IPV4}`)).toBe(
      `${REDACTION_PLACEHOLDER} and ${REDACTION_PLACEHOLDER}`,
    );
  });
});

describe('createTelemetryScrubber — CANARY test', () => {
  const scrub = createTelemetryScrubber({ patterns: APP_PATTERNS });

  it('strips every forbidden canary from message, extra, breadcrumbs, and nested contexts', () => {
    const event: ScrubbableEvent = {
      message: `error handling ${FAKE_PRIVATE_URL} from ${FAKE_IPV4}`,
      exception: {
        values: [
          {
            type: 'Error',
            value: `vendor key leaked: ${FAKE_VENDOR_KEY}`,
            stacktrace: {
              frames: [
                {
                  filename: 'handler.ts',
                  vars: { hash: FAKE_DIGEST, ip: FAKE_IPV6 },
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        {
          category: 'app',
          message: `uploaded to ${FAKE_PRIVATE_URL}`,
          data: { clientIp: FAKE_IPV4, vendorKey: FAKE_VENDOR_KEY },
        },
      ],
      extra: {
        digest: FAKE_DIGEST,
        nested: { deep: { fileUrl: FAKE_PRIVATE_URL, list: [FAKE_IPV6, 'fine'] } },
      },
      contexts: {
        app: {
          record: {
            fileUrl: FAKE_PRIVATE_URL,
            clientIp: FAKE_IPV4,
            digest: FAKE_DIGEST,
          },
        },
      },
      tags: { peer: FAKE_IPV4 },
      request: {
        url: FAKE_PRIVATE_URL,
        headers: { authorization: FAKE_BEARER, 'x-forwarded-for': FAKE_IPV4 },
      },
      user: { ip_address: FAKE_IPV4, id: 'uid-123' },
    };

    const scrubbed = scrub(event);

    expect(scrubbed).not.toBeNull();
    assertNoCanariesSurvive(scrubbed);

    const serialized = JSON.stringify(scrubbed);
    expect(serialized).toContain(REDACTION_PLACEHOLDER);
    expect(serialized).toContain('uid-123');
    expect(serialized).toContain('"record"');
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

  it('works with only default patterns (no app patterns supplied)', () => {
    const defaultScrub = createTelemetryScrubber();
    const event: ScrubbableEvent = { message: `peer ${FAKE_IPV4}`, extra: { ip6: FAKE_IPV6 } };
    const out = defaultScrub(event) as ScrubbableEvent;
    expect(JSON.stringify(out)).not.toContain(FAKE_IPV4);
    expect(JSON.stringify(out)).not.toContain(FAKE_IPV6);
  });
});

const FAKE_OOB = 'Xk9_aB-cD3efGHijkLMnop2qRsTuv';
const ACTION_ORIGIN = 'https://example.test/auth/action';

describe('oobCode redaction (Firebase email-action one-time code)', () => {
  it('redacts oobCode while leaving origin, path, and mode readable', () => {
    const out = redactString(`${ACTION_ORIGIN}?mode=resetPassword&oobCode=${FAKE_OOB}`);
    expect(out).not.toContain(FAKE_OOB);
    expect(out).toContain(REDACTION_PLACEHOLDER);
    expect(out).toContain('https://example.test/auth/action');
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

    const out = createTelemetryScrubber({ patterns: APP_PATTERNS })(event);

    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(FAKE_OOB);
    expect(serialized).toContain(REDACTION_PLACEHOLDER);
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

    const withDefaults: ScrubbableEvent = { message: url };
    redactEvent(withDefaults, { patterns: APP_PATTERNS });
    expect(withDefaults.message).not.toContain(FAKE_OOB);

    const withoutDefaults: ScrubbableEvent = { message: url };
    redactEvent(withoutDefaults, { patterns: APP_PATTERNS, includeDefaults: false });
    expect(withoutDefaults.message).toContain(FAKE_OOB);
  });
});

const FAKE_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1aWQtMTIzIn0.Xk9_aB-cD3efGH';

describe('id_token redaction (OIDC / Firebase ID token in a URL)', () => {
  it('redacts every spelling while leaving following params readable', () => {
    for (const key of ['id_token', 'idToken', 'id-token', 'ID_TOKEN']) {
      const out = redactString(`https://example.test/cb?${key}=${FAKE_JWT}&state=abc`);
      expect(out, `key: ${key}`).not.toContain(FAKE_JWT);
      expect(out, `key: ${key}`).toContain(REDACTION_PLACEHOLDER);
      expect(out, `key: ${key}`).toContain('state=abc');
    }
  });

  it('consumes a whole JWT (dots, hyphens, underscores) and stops at &', () => {
    const out = redactString(`https://example.test/cb?id_token=${FAKE_JWT}&next=/account`);
    expect(out).toBe(`https://example.test/cb?${REDACTION_PLACEHOLDER}&next=/account`);
  });

  it('redacts an id_token at end-of-string', () => {
    const out = redactString(`https://example.test/cb?state=abc&id_token=${FAKE_JWT}`);
    expect(out).not.toContain(FAKE_JWT);
    expect(out).toContain('state=abc');
  });

  it('strips id_token from request.url and navigation breadcrumbs', () => {
    const url = `https://example.test/cb?id_token=${FAKE_JWT}&state=abc`;
    const event: ScrubbableEvent = {
      request: { url },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: url } }],
    };
    const serialized = JSON.stringify(createTelemetryScrubber({ patterns: APP_PATTERNS })(event));
    expect(serialized).not.toContain(FAKE_JWT);
    expect(serialized).toContain('state=abc');
  });

  it('leaves a plural/compound word containing "token" untouched', () => {
    const ok = 'counts: valid_tokens=12 invalid_tokens=3 tokenizer=lexer';
    expect(redactString(ok)).toBe(ok);
  });
});

describe('compound token parameters', () => {
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
      const out = redactString(`https://example.test/cb?${key}=${FAKE_JWT}&state=abc`);
      expect(out, `key: ${key}`).not.toContain(FAKE_JWT);
      expect(out, `key: ${key}`).toContain(REDACTION_PLACEHOLDER);
      expect(out, `key: ${key}`).toContain('state=abc');
    }
  });

  it('strips a compound token from request.url and navigation breadcrumbs', () => {
    const url = `https://example.test/cb?sessionToken=${FAKE_JWT}&state=abc`;
    const event: ScrubbableEvent = {
      request: { url },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: url } }],
    };
    const serialized = JSON.stringify(createTelemetryScrubber({ patterns: APP_PATTERNS })(event));
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

  it('falls back to the greedy shared pattern when a token value contains an early &', () => {
    for (const probe of ['token=ab&cdef', 'access_token=xy&zzzz', 'refresh_token=a&bcdefgh']) {
      expect(redactString(probe), `probe: ${probe}`).toBe(REDACTION_PLACEHOLDER);
    }
  });
});

describe('redactEvent — direct backend use', () => {
  it('scrubs an event object for the withScope / manual-capture path', () => {
    const event: ScrubbableEvent = {
      message: `denied serving for ${FAKE_PRIVATE_URL}`,
      extra: { hash: FAKE_DIGEST },
    };
    redactEvent(event, { patterns: APP_PATTERNS });
    assertNoCanariesSurvive(event);
  });

  it('can exclude generic defaults when includeDefaults is false', () => {
    const event: ScrubbableEvent = { message: `ip ${FAKE_IPV4} hash ${FAKE_DIGEST}` };
    redactEvent(event, { patterns: APP_PATTERNS, includeDefaults: false });
    expect(event.message).toContain(FAKE_IPV4);
    expect(event.message).not.toContain(FAKE_DIGEST);
  });
});

describe('transaction and replay events — every place a page URL rides', () => {
  const RESET_URL =
    'https://example.test/auth/action?mode=resetPassword&oobCode=AbCdEfGh123456&lang=en';

  it('redacts the reset code from a page-load transaction name', () => {
    const event: ScrubbableEvent = { type: 'transaction', transaction: RESET_URL };
    const out = createTelemetryScrubber()(event)!;
    expect(out.transaction).not.toContain('AbCdEfGh123456');
    expect(out.transaction).toContain('mode=resetPassword');
  });

  it('redacts the reset code from span descriptions and span data', () => {
    const event: ScrubbableEvent = {
      type: 'transaction',
      spans: [
        {
          op: 'browser.request',
          description: RESET_URL,
          span_id: 'aaaa1111bbbb2222',
          data: { url: RESET_URL },
        },
        { op: 'navigation', description: 'GET /home', span_id: 'cccc3333dddd4444' },
      ],
    };
    const out = createTelemetryScrubber()(event)!;
    const spans = out.spans as Array<Record<string, unknown>>;
    expect(JSON.stringify(spans)).not.toContain('AbCdEfGh123456');
    expect(spans[0].description).toContain(REDACTION_PLACEHOLDER);
    expect((spans[0].data as Record<string, unknown>).url).toContain(REDACTION_PLACEHOLDER);
    expect(spans[1].description).toBe('GET /home');
  });

  it("leaves a span's ids and op intact so the trace still assembles", () => {
    const event: ScrubbableEvent = {
      type: 'transaction',
      spans: [
        {
          op: 'browser.request',
          span_id: 'aaaa1111bbbb2222',
          trace_id: 'f'.repeat(32),
          description: RESET_URL,
        },
      ],
    };
    const out = createTelemetryScrubber()(event)!;
    const span = (out.spans as Array<Record<string, unknown>>)[0];
    expect(span.span_id).toBe('aaaa1111bbbb2222');
    expect(span.trace_id).toBe('f'.repeat(32));
    expect(span.op).toBe('browser.request');
  });

  it("redacts the reset code from a replay event's visited URLs", () => {
    const event: ScrubbableEvent = {
      type: 'replay_event',
      urls: ['https://example.test/home', RESET_URL],
    };
    const out = createTelemetryScrubber()(event)!;
    const urls = out.urls as string[];
    expect(urls[0]).toBe('https://example.test/home');
    expect(urls[1]).not.toContain('AbCdEfGh123456');
    expect(urls[1]).toContain(REDACTION_PLACEHOLDER);
  });

  it('applies the app-injected patterns to spans and replay URLs too', () => {
    const event: ScrubbableEvent = {
      transaction: `/items/${FAKE_DIGEST}`,
      spans: [{ description: `GET ${FAKE_PRIVATE_URL}` }],
      urls: [`https://example.test/items/${FAKE_DIGEST}`],
    };
    const out = createTelemetryScrubber({ patterns: APP_PATTERNS })(event)!;
    expect(JSON.stringify(out)).not.toContain(FAKE_DIGEST);
    expect(JSON.stringify(out)).not.toContain(FAKE_PRIVATE_PREFIX);
  });
});
