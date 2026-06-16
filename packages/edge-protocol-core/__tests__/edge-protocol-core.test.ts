import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  sha256Hex,
  hashPayload,
  signInternalRequest,
  verifyInternalRequest,
  signToken,
  verifyToken,
  decideVersionedApply,
  StructuredErrorSchema,
  EDGE_PROTOCOL_VERSION,
  isProtocolSupported,
  type InternalRequestFields,
} from '../src/index.js';

describe('payload-hash', () => {
  it('canonicalize sorts object keys recursively and is order-independent', () => {
    const a = canonicalize({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalize({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('canonicalize preserves array order and drops undefined props', () => {
    expect(canonicalize({ x: [3, 1, 2], y: undefined, z: 4 })).toBe('{"x":[3,1,2],"z":4}');
  });

  it('sha256Hex matches a known vector', async () => {
    // SHA-256("") is the well-known empty-string digest.
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hashPayload is deterministic regardless of key order', async () => {
    const h1 = await hashPayload({ v: 2, owner: 'u1', kind: 'x' });
    const h2 = await hashPayload({ kind: 'x', owner: 'u1', v: 2 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('internal-auth', () => {
  const secret = 'test-media-authority-secret';
  const fields: InternalRequestFields = {
    audience: 'ttt-media-authority:test',
    method: 'POST',
    path: '/internal/media-authority/apply',
    bodyHash: 'a'.repeat(64),
    operationId: 'op-123',
    timestampSec: 1_000_000,
  };

  it('sign → verify round-trips within the replay window', async () => {
    const sig = await signInternalRequest(fields, secret);
    expect(sig.version).toBe('v1');
    const res = await verifyInternalRequest(
      { ...fields, version: sig.version, signature: sig.signature, nowSec: 1_000_100, replayWindowSec: 300 },
      secret,
    );
    expect(res).toEqual({ ok: true });
  });

  it('rejects a tampered body hash', async () => {
    const sig = await signInternalRequest(fields, secret);
    const res = await verifyInternalRequest(
      { ...fields, bodyHash: 'b'.repeat(64), version: sig.version, signature: sig.signature, nowSec: 1_000_010, replayWindowSec: 300 },
      secret,
    );
    expect(res).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a tampered path / method / operationId', async () => {
    const sig = await signInternalRequest(fields, secret);
    for (const override of [{ path: '/internal/other' }, { method: 'GET' }, { operationId: 'op-999' }]) {
      const res = await verifyInternalRequest(
        { ...fields, ...override, version: sig.version, signature: sig.signature, nowSec: 1_000_010, replayWindowSec: 300 },
        secret,
      );
      expect(res).toEqual({ ok: false, reason: 'bad-signature' });
    }
  });

  it('rejects the wrong secret', async () => {
    const sig = await signInternalRequest(fields, secret);
    const res = await verifyInternalRequest(
      { ...fields, version: sig.version, signature: sig.signature, nowSec: 1_000_010, replayWindowSec: 300 },
      'other-secret',
    );
    expect(res).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('enforces the replay window (expired past / future)', async () => {
    const sig = await signInternalRequest(fields, secret);
    const expired = await verifyInternalRequest(
      { ...fields, version: sig.version, signature: sig.signature, nowSec: 1_000_000 + 301, replayWindowSec: 300 },
      secret,
    );
    expect(expired).toEqual({ ok: false, reason: 'expired' });
    const future = await verifyInternalRequest(
      { ...fields, version: sig.version, signature: sig.signature, nowSec: 1_000_000 - 301, replayWindowSec: 300 },
      secret,
    );
    expect(future).toEqual({ ok: false, reason: 'future' });
  });

  it('rejects a bad protocol version and a malformed signature', async () => {
    const sig = await signInternalRequest(fields, secret);
    const badVer = await verifyInternalRequest(
      { ...fields, version: 'v2', signature: sig.signature, nowSec: 1_000_010, replayWindowSec: 300 },
      secret,
    );
    expect(badVer).toEqual({ ok: false, reason: 'bad-version' });
    const badSig = await verifyInternalRequest(
      { ...fields, version: sig.version, signature: '!!!not-base64url!!!', nowSec: 1_000_010, replayWindowSec: 300 },
      secret,
    );
    expect(badSig.ok).toBe(false);
  });
});

describe('signed-token', () => {
  const secret = 'shared-media-session-secret';

  it('produces the canonical v1.{payload}.{sig} shape and round-trips the opaque payload', async () => {
    const claims = { v: 1, typ: 'session', uid: 'u1', art: 0, adm: 1, iat: 100, exp: 999 };
    const token = await signToken(claims, secret);
    expect(token.split('.')).toHaveLength(3);
    expect(token.startsWith('v1.')).toBe(true);
    expect(await verifyToken(token, secret)).toEqual(claims);
  });

  it('verifies to null on a tampered payload, tampered signature, or wrong secret', async () => {
    const token = await signToken({ typ: 'grant', uid: 'u1', exp: 999 }, secret);
    const [, payloadB64, sigB64] = token.split('.');
    expect(await verifyToken(`v1.${payloadB64}x.${sigB64}`, secret)).toBeNull();
    expect(await verifyToken(`v1.${payloadB64}.${sigB64.slice(0, -2)}AA`, secret)).toBeNull();
    expect(await verifyToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a non-v1 prefix and malformed tokens', async () => {
    const token = await signToken({ a: 1 }, secret);
    const [, payloadB64, sigB64] = token.split('.');
    expect(await verifyToken(`v2.${payloadB64}.${sigB64}`, secret)).toBeNull();
    expect(await verifyToken('not-a-token', secret)).toBeNull();
    expect(await verifyToken('v1.only-two', secret)).toBeNull();
  });

  it('does NOT enforce claims — an expired-looking payload still verifies (caller checks exp)', async () => {
    const token = await signToken({ typ: 'session', uid: 'u1', exp: 1 }, secret);
    expect(await verifyToken(token, secret)).toEqual({ typ: 'session', uid: 'u1', exp: 1 });
  });
});

describe('versioned-apply', () => {
  it('applies when there is no stored record', () => {
    expect(decideVersionedApply({ incomingVersion: 1, incomingHash: 'h', storedVersion: null, storedHash: null })).toBe('apply');
  });
  it('applies a newer version', () => {
    expect(decideVersionedApply({ incomingVersion: 3, incomingHash: 'h', storedVersion: 2, storedHash: 'g' })).toBe('apply');
  });
  it('is idempotent at equal version + same hash', () => {
    expect(decideVersionedApply({ incomingVersion: 2, incomingHash: 'h', storedVersion: 2, storedHash: 'h' })).toBe('idempotent');
  });
  it('conflicts at equal version + different hash', () => {
    expect(decideVersionedApply({ incomingVersion: 2, incomingHash: 'h', storedVersion: 2, storedHash: 'g' })).toBe('conflict');
  });
  it('is a stale no-op for an older version', () => {
    expect(decideVersionedApply({ incomingVersion: 1, incomingHash: 'h', storedVersion: 2, storedHash: 'g' })).toBe('stale');
  });
});

describe('envelopes', () => {
  it('StructuredError parses a minimal + full shape and rejects extras', () => {
    expect(StructuredErrorSchema.parse({ code: 'x', message: 'm' }).code).toBe('x');
    expect(
      StructuredErrorSchema.parse({ code: 'x', message: 'm', retryable: true, details: { a: 1 }, at: 5 }).retryable,
    ).toBe(true);
    expect(StructuredErrorSchema.safeParse({ code: 'x', message: 'm', bogus: 1 }).success).toBe(false);
  });

  it('isProtocolSupported allows one rolling version of skew', () => {
    expect(isProtocolSupported(EDGE_PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolSupported(EDGE_PROTOCOL_VERSION + 1)).toBe(true);
    expect(isProtocolSupported(EDGE_PROTOCOL_VERSION + 2)).toBe(false);
    expect(isProtocolSupported(0)).toBe(false);
  });
});
