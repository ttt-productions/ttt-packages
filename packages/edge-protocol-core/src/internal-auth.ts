import { bytesToB64url, b64urlToBytes, hmacKey } from './crypto-internal.js';
import type { InternalPrecheckHeaderNames } from './internal-auth-headers.js';

const SIGNING_VERSION = 'v1';

export interface InternalRequestFields {
  audience: string;
  method: string;
  path: string;
  bodyHash: string;
  operationId: string;
  timestampSec: number;
}

export interface InternalSignature {
  version: typeof SIGNING_VERSION;
  timestampSec: number;
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
  'bad-version' | 'bad-timestamp' | 'expired' | 'future' | 'bad-signature';

export type InternalVerifyResult = { ok: true } | { ok: false; reason: InternalVerifyFailure };

export interface InternalVerifyInput extends InternalRequestFields {
  version: string;
  signature: string;
  nowSec: number;
  replayWindowSec: number;
}

export type InternalPrecheckFailure = Exclude<InternalVerifyFailure, 'bad-signature'>;

export type InternalPrecheckResult =
  | { ok: true; version: typeof SIGNING_VERSION; timestampSec: number }
  | { ok: false; reason: InternalPrecheckFailure };

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

function parseTimestampHeader(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return Number.NaN;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

export function precheckInternalHeaders(
  headers: { get(name: string): string | null },
  names: InternalPrecheckHeaderNames,
  options: { nowSec: number; replayWindowSec: number },
): InternalPrecheckResult {
  const version = headers.get(names.version);
  const timestampSec = parseTimestampHeader(headers.get(names.timestamp));
  const check = checkVersionAndWindow(
    version,
    timestampSec,
    options.nowSec,
    options.replayWindowSec,
  );
  if (!check.ok) return check;
  return { ok: true, version: SIGNING_VERSION, timestampSec };
}

export async function verifyInternalRequest(
  input: InternalVerifyInput,
  secret: string,
): Promise<InternalVerifyResult> {
  const check = checkVersionAndWindow(
    input.version,
    input.timestampSec,
    input.nowSec,
    input.replayWindowSec,
  );
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
