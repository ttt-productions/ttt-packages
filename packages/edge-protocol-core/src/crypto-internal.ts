// Shared WebCrypto helpers used by both the internal-request signer
// (internal-auth.ts) and the signed-token primitive (signed-token.ts). Internal
// to the package — not part of the public API. WebCrypto only, so the same code
// runs in Node 22, Cloudflare Workers, and browsers.

/** base64url-encode raw bytes (no padding). */
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url-decode to bytes; returns null on malformed input (fail closed). */
export function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Import an HMAC-SHA256 key for the given usage. */
export function hmacKey(secret: string, usage: 'verify' | 'sign'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}
