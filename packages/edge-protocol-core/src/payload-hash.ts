// Canonical payload hashing — the shared `payloadHash` primitive used by the
// versioned-apply rule and every signed internal edge call (media-authority
// apply, and later chat sync/command/outbox). WebCrypto only, so the SAME code
// runs in Cloud Functions (Node 22) and Cloudflare Workers/DOs.
//
// The hash is computed over a DETERMINISTIC serialization (object keys sorted
// recursively) so the same logical payload always produces the same digest
// across processes and runtimes — the property the apply rule depends on
// ("equal version + identical payloadHash ⇒ idempotent").

/**
 * Deterministic JSON: object keys sorted recursively; arrays keep order;
 * `undefined` properties are dropped (standard JSON semantics). The same
 * logical value always serializes to the same string.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      const val = src[k];
      if (val !== undefined) out[k] = sortValue(val);
    }
    return out;
  }
  return v;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

/** Lowercase-hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Canonical hash of a payload object: sorted-key serialization → SHA-256 hex.
 * This is the `payloadHash` of the serving-record / sync contracts; it is
 * computed over the payload fields EXCLUDING the hash itself (callers pass the
 * payload without its `payloadHash`/`authorityPayloadHash` field).
 */
export async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(canonicalize(payload));
}
