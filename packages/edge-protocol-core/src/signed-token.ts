import { bytesToB64url, b64urlToBytes, hmacKey } from './crypto-internal.js';

const TOKEN_VERSION = 'v1';

export async function signToken(payload: object, secret: string): Promise<string> {
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${TOKEN_VERSION}.${payloadB64}`),
  );
  return `${TOKEN_VERSION}.${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

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
