import { describe, it, expect, vi } from 'vitest';
import { readBoundedBody, sha256Hex, type BoundedBodySource } from '../src/index.js';

const encoder = new TextEncoder();

/** A request whose body arrives in the given chunks, recording how much was pulled and whether it was cancelled. */
function streamedRequest(chunks: Uint8Array[], contentLength?: string) {
  let pulled = 0;
  const cancel = vi.fn(async () => {});
  const headers = new Headers(contentLength === undefined ? {} : { 'content-length': contentLength });
  const source: BoundedBodySource = {
    headers,
    body: {
      getReader: () => ({
        read: async () => {
          const value = chunks[pulled];
          if (!value) return { done: true };
          pulled += 1;
          return { done: false, value };
        },
        cancel,
      }),
      cancel,
    },
  };
  return { source, cancel, pulled: () => pulled };
}

describe('readBoundedBody', () => {
  it('returns the body text when it fits the budget', async () => {
    const body = JSON.stringify({ record: { assetId: 'a1' } });
    const result = await readBoundedBody(new Request('https://x.test/p', { method: 'POST', body }), {
      maxBytes: 1024,
    });
    expect(result).toEqual({ ok: true, text: body });
  });

  it('accepts a body of exactly the budget', async () => {
    const { source } = streamedRequest([encoder.encode('abcd'), encoder.encode('efgh')], '8');
    await expect(readBoundedBody(source, { maxBytes: 8 })).resolves.toEqual({ ok: true, text: 'abcdefgh' });
  });

  it('refuses a declared Content-Length over the budget without reading the body', async () => {
    const { source, cancel, pulled } = streamedRequest([encoder.encode('x')], '9');

    const result = await readBoundedBody(source, { maxBytes: 8 });

    expect(result).toEqual({ ok: false, reason: 'too-large', maxBytes: 8 });
    expect(pulled()).toBe(0);
    expect(cancel).toHaveBeenCalled();
  });

  it('stops reading and cancels the stream once the bytes pass the budget with no Content-Length', async () => {
    const { source, cancel, pulled } = streamedRequest([
      encoder.encode('12345'),
      encoder.encode('67890'),
      encoder.encode('never read'),
    ]);

    const result = await readBoundedBody(source, { maxBytes: 8 });

    expect(result).toEqual({ ok: false, reason: 'too-large', maxBytes: 8 });
    expect(pulled()).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('enforces the budget on the bytes sent when the Content-Length understates them', async () => {
    const { source, pulled } = streamedRequest([encoder.encode('12345'), encoder.encode('67890')], '4');

    const result = await readBoundedBody(source, { maxBytes: 8 });

    expect(result).toEqual({ ok: false, reason: 'too-large', maxBytes: 8 });
    expect(pulled()).toBe(2);
  });

  it('ignores an unparseable Content-Length and still counts the bytes', async () => {
    const { source } = streamedRequest([encoder.encode('ok')], 'lots');
    await expect(readBoundedBody(source, { maxBytes: 8 })).resolves.toEqual({ ok: true, text: 'ok' });
  });

  it('decodes multi-byte characters split across chunks exactly as request.text() does', async () => {
    const bytes = encoder.encode('{"name":"café ✓"}');
    const { source } = streamedRequest([bytes.slice(0, 13), bytes.slice(13)]);
    const expected = await new Request('https://x.test/p', { method: 'POST', body: bytes }).text();

    const result = await readBoundedBody(source, { maxBytes: 1024 });

    expect(result).toEqual({ ok: true, text: expected });
    expect(await sha256Hex((result as { text: string }).text)).toBe(await sha256Hex(expected));
  });

  it('reads an absent body as empty text', async () => {
    const result = await readBoundedBody({ headers: new Headers(), body: null }, { maxBytes: 0 });
    expect(result).toEqual({ ok: true, text: '' });
  });

  it('rejects a budget that is not a non-negative integer', async () => {
    const { source } = streamedRequest([]);
    await expect(readBoundedBody(source, { maxBytes: -1 })).rejects.toThrow(RangeError);
    await expect(readBoundedBody(source, { maxBytes: 1.5 })).rejects.toThrow(RangeError);
  });
});
