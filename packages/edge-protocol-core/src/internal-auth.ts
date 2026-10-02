// Internal request signing/verification — the canonical HMAC scheme for signed
// backend → Worker/DO calls (media-authority `apply` and the chat internal
// sync/command/outbox endpoints). A SEPARATE concern from the session/grant token
// in signed-token.ts: each consumer uses its own secret + audience (e.g.
// MEDIA_AUTHORITY_SYNC_SECRET, audience `media-authority:{env}`). WebCrypto only —
// runs in Node 24 + Workers.
//
// The signature covers: protocol marker, audience, method, exact path, timestamp,
// SHA-256 body hash, and a deterministic operationId. A narrow replay window is
// enforced on verify, and — from the headers alone, before any body is read — by
// the pre-body check. Everything fails closed: any malformed/mistyped/expired/
// tampered input verifies to a typed failure, never a throw.

import { bytesToB64url, b64urlToBytes, hmacKey } from './crypto-internal.js';
import {
  INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER,
  INTERNAL_AUTH_OPERATION_VERSION_HEADER,
} from './internal-auth-headers.js';

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

/** The checks that need no body and no secret — the signing version and the replay window. */
export type InternalPrecheckFailure = Exclude<InternalVerifyFailure, 'bad-signature'>;

/**
 * The cheap pre-body answer. On success it carries the version and the parsed timestamp, so
 * the caller hands {@link verifyInternalRequest} the same values instead of re-reading the
 * headers.
 */
export type InternalPrecheckResult =
  | { ok: true; version: typeof SIGNING_VERSION; timestampSec: number }
  | { ok: false; reason: InternalPrecheckFailure };

/** The one version + replay-window rule, shared by the pre-body check and the full verify. */
function checkVersionAndWindow(
  version: unknown,
  timestampSec: unknown,
  nowSec: number,
  replayWindowSec: number,
): { ok: true } | { ok: false; reason: InternalPrecheckFailure } {
  if (version !== SIGNING_VERSION) return { ok: false, reason: 'bad-version' };
  if (typeof timestampSec !== 'number' || !Number.isFinite(timestampSec)) {
    return { ok: false, reason: 'bad-timestamp' };
  }
  const skew = nowSec - timestampSec;
  if (skew > replayWindowSec) return { ok: false, reason: 'expired' };
  if (skew < -replayWindowSec) return { ok: false, reason: 'future' };
  return { ok: true };
}

/** The timestamp header is decimal seconds, digits only; anything else is not a timestamp. */
function parseTimestampHeader(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return Number.NaN;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

/**
 * The pre-body rejects for an operation-id-profile request (ARCH-005): the signing version and
 * the timestamp window, read from the headers alone. An endpoint whose signature covers the body
 * runs this BEFORE reading the body, so an unsigned request with a missing, stale, or
 * future-dated timestamp is refused without buffering anything. It applies the same rule as
 * {@link verifyInternalRequest}, which still runs (and re-checks) after the bounded body read.
 */
export function precheckInternalHeaders(
  headers: { get(name: string): string | null },
  options: { nowSec: number; replayWindowSec: number },
): InternalPrecheckResult {
  const version = headers.get(INTERNAL_AUTH_OPERATION_VERSION_HEADER);
  const timestampSec = parseTimestampHeader(headers.get(INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER));
  const check = checkVersionAndWindow(version, timestampSec, options.nowSec, options.replayWindowSec);
  if (!check.ok) return check;
  return { ok: true, version: SIGNING_VERSION, timestampSec };
}

/** Verify an internal request signature + replay window. Fails closed. */
export async function verifyInternalRequest(
  input: InternalVerifyInput,
  secret: string,
): Promise<InternalVerifyResult> {
  const check = checkVersionAndWindow(input.version, input.timestampSec, input.nowSec, input.replayWindowSec);
  if (!check.ok) return check;

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
