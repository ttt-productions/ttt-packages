// Bounded request-body reading for endpoints that must authenticate a body before trusting it
// (ARCH-005): the body an HMAC covers has to be read before the signature can be checked, so
// that read is the one piece of unauthenticated work the endpoint does, and it is capped. A
// declared Content-Length over the budget is refused without reading; otherwise the stream is
// read with a running byte count and cancelled the moment it passes the budget, so a missing
// or false Content-Length buys nothing. Runtime-neutral: a Cloudflare Workers or Node `Request`
// satisfies `BoundedBodySource` structurally.

/** The subset of a byte-stream reader this module uses. */
interface BodyReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(reason?: unknown): Promise<void>;
}

/** Anything with request headers and a readable byte-stream body (a `Request`). */
export interface BoundedBodySource {
  headers: { get(name: string): string | null };
  body: { getReader(): BodyReader; cancel?(reason?: unknown): Promise<void> } | null;
}

export interface BoundedBodyReadOptions {
  /** The largest body, in bytes, the endpoint accepts. A non-negative integer. */
  maxBytes: number;
}

/**
 * `ok: true` carries the body decoded as UTF-8 exactly as `request.text()` decodes it — the
 * text a signed body's hash is computed over. `too-large` means the declared length or the
 * bytes actually sent passed `maxBytes`; the caller answers it (typically 413) and does no
 * further work on the request.
 */
export type BoundedBodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too-large'; maxBytes: number };

const DECLARED_LENGTH = /^\d+$/;

async function cancelQuietly(cancel: (() => Promise<void>) | undefined): Promise<void> {
  try {
    await cancel?.();
  } catch {
    // The request is being refused either way; a stream that will not cancel changes nothing.
  }
}

export async function readBoundedBody(
  source: BoundedBodySource,
  options: BoundedBodyReadOptions,
): Promise<BoundedBodyReadResult> {
  const { maxBytes } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('readBoundedBody: maxBytes must be a non-negative integer.');
  }
  const tooLarge: BoundedBodyReadResult = { ok: false, reason: 'too-large', maxBytes };

  const declared = source.headers.get('content-length')?.trim();
  if (declared && DECLARED_LENGTH.test(declared) && Number(declared) > maxBytes) {
    const body = source.body;
    await cancelQuietly(body?.cancel ? () => body.cancel!() : undefined);
    return tooLarge;
  }

  if (!source.body) return { ok: true, text: '' };

  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await cancelQuietly(() => reader.cancel());
      return tooLarge;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
