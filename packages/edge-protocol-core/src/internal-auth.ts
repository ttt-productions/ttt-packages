// Internal request signing/verification — the canonical HMAC scheme for signed
// backend → Worker/DO calls (media-authority `apply`, and later chat internal
// sync/command/outbox endpoints). Reuses the media Worker's `v1.` HMAC-SHA256
// pattern (token.ts) but is a SEPARATE concern from the session/grant cookie:
// each consumer uses its own secret + audience (e.g. MEDIA_AUTHORITY_SYNC_SECRET,
// audience `media-authority:{env}`). WebCrypto only — runs in Node 22 + Workers.
//
// The signature covers: protocol marker, audience, method, exact path, timestamp,
// SHA-256 body hash, and a deterministic operationId. A narrow replay window is
// enforced on verify. Everything fails closed: any malformed/mistyped/expired/
// tampered input verifies to a typed failure, never a throw.

import { bytesToB64url, b64urlToBytes, hmacKey } from './crypto-internal.js';

const SIGNING_VERSION = 'v1';

/** The fields covered by the signature. The verifier reconstructs this exact
 * string, so any divergence (wrong path, method, body, audience, operationId,
 * or timestamp) fails the MAC. */
export interface InternalRequestFields {
  /** Per-consumer audience, e.g. `media-authority:prod`. */
  audience: string;
  /** HTTP method, e.g. `POST` (compared case-insensitively via upper-casing). */
  method: string;
  /** Exact request path, e.g. `/internal/media-authority/apply`. */
  path: string;
  /** Lowercase-hex SHA-256 of the raw request body (see `hashPayload`/`sha256Hex`). */
  bodyHash: string;
  /** Deterministic per-operation id (idempotency key) also bound into the MAC. */
  operationId: string;
  /** Unix timestamp in SECONDS. Bound into the MAC and checked against the replay window. */
  timestampSec: number;
}

export interface InternalSignature {
  version: typeof SIGNING_VERSION;
  timestampSec: number;
  /** base64url(HMAC-SHA256(secret, signingString)). */
  signature: string;
}

function buildSigningString(f: InternalRequestFields): string {
  return [
    SIGNING_VERSION,
    f.audience,
    f.method.toUpperCase(),
    f.path,
    String(f.timestampSec),
    f.bodyHash,
    f.operationId,
  ].join('\n');
}

/** Sign an internal request. The caller transmits `{version, timestampSec, signature}`
 * plus the covered fields; the receiver verifies with {@link verifyInternalRequest}. */
export async function signInternalRequest(
  fields: InternalRequestFields,
  secret: string,
): Promise<InternalSignature> {
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(buildSigningString(fields)),
  );
  return {
    version: SIGNING_VERSION,
    timestampSec: fields.timestampSec,
    signature: bytesToB64url(new Uint8Array(sig)),
  };
}

export type InternalVerifyFailure =
  | 'bad-version'
  | 'bad-timestamp'
  | 'expired'
  | 'future'
  | 'bad-signature';

export type InternalVerifyResult = { ok: true } | { ok: false; reason: InternalVerifyFailure };

export interface InternalVerifyInput extends InternalRequestFields {
  version: string;
  signature: string;
  /** Current time in SECONDS. */
  nowSec: number;
  /** Max allowed clock difference in seconds (narrow, e.g. 300). */
  replayWindowSec: number;
}

/** Verify an internal request signature + replay window. Fails closed. */
export async function verifyInternalRequest(
  input: InternalVerifyInput,
  secret: string,
): Promise<InternalVerifyResult> {
  if (input.version !== SIGNING_VERSION) return { ok: false, reason: 'bad-version' };
  if (typeof input.timestampSec !== 'number' || !Number.isFinite(input.timestampSec)) {
    return { ok: false, reason: 'bad-timestamp' };
  }
  const skew = input.nowSec - input.timestampSec;
  if (skew > input.replayWindowSec) return { ok: false, reason: 'expired' };
  if (skew < -input.replayWindowSec) return { ok: false, reason: 'future' };

  const sigBytes = b64urlToBytes(input.signature);
  if (!sigBytes) return { ok: false, reason: 'bad-signature' };

  const key = await hmacKey(secret, 'verify');
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(buildSigningString(input)),
  );
  return ok ? { ok: true } : { ok: false, reason: 'bad-signature' };
}
