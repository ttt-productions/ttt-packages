// Signed-token primitive — the opaque `v1.{base64url(JSON)}.{base64url(HMAC-SHA256(
// secret, "v1."+payloadB64))}` format used by the media-session cookie and the
// media/chat grants. The single canonical implementation: the Next media-session
// route + createMediaGrant SIGN with it, and the media Worker + chat Worker VERIFY
// with it, so the wire format can't drift across the four reimplementations it
// replaced. WebCrypto only — runs in Node 22, Cloudflare Workers, and browsers.
//
// Distinct from internal-auth.ts: that binds method/exact-path/body-hash/audience
// for backend→Worker/DO calls; THIS is the user-facing token whose JSON payload is
// OPAQUE here. Callers stamp + validate their own claims (`typ`/`aud`/`env`/`exp`):
// this primitive only proves the payload was signed by a holder of the secret.
// Fail-closed: any malformed / bad-signature / non-`v1` token verifies to null.

import { bytesToB64url, b64urlToBytes, hmacKey } from './crypto-internal.js';

const TOKEN_VERSION = 'v1';

/** Sign a payload object into the `v1.{payloadB64}.{sigB64}` token. */
export async function signToken(payload: object, secret: string): Promise<string> {
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${TOKEN_VERSION}.${payloadB64}`));
  return `${TOKEN_VERSION}.${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

/**
 * Verify a token's signature and return its parsed payload, or null on any
 * failure (wrong version, malformed base64url, bad signature, non-JSON payload).
 * Does NOT check expiry or any claim — the caller validates `typ`/`aud`/`exp`.
 */
export async function verifyToken(token: string, secret: string): Promise<unknown | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, payloadB64, sigB64] = parts;

  const sigBytes = b64urlToBytes(sigB64);
  const payloadBytes = b64urlToBytes(payloadB64);
  if (!sigBytes || !payloadBytes) return null;

  const key = await hmacKey(secret, 'verify');
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(`${TOKEN_VERSION}.${payloadB64}`),
  );
  if (!ok) return null;

  try {
    return JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
}
