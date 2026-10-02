import { describe, it, expect } from 'vitest';
import {
  precheckInternalHeaders,
  signInternalRequest,
  verifyInternalRequest,
  INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER,
  INTERNAL_AUTH_OPERATION_VERSION_HEADER,
  INTERNAL_AUTH_TIMESTAMP_HEADER,
  INTERNAL_AUTH_VERSION_HEADER,
  type InternalRequestFields,
} from '../src/index.js';

const NOW = 1_700_000_000;
const WINDOW = 300;
const SECRET = 'test-secret-value';

function headersOf(entries: Record<string, string>) {
  return new Headers(entries);
}

function precheck(entries: Record<string, string>, nowSec = NOW) {
  return precheckInternalHeaders(headersOf(entries), { nowSec, replayWindowSec: WINDOW });
}

describe('precheckInternalHeaders', () => {
  it('accepts the signing version with an in-window timestamp and hands back both values', () => {
    expect(
      precheck({
        [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: 'v1',
        [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(NOW - 10),
      }),
    ).toEqual({ ok: true, version: 'v1', timestampSec: NOW - 10 });
  });

  it('refuses a missing or unknown signing version', () => {
    expect(precheck({ [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(NOW) })).toEqual({
      ok: false,
      reason: 'bad-version',
    });
    expect(
      precheck({
        [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: 'v2',
        [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(NOW),
      }),
    ).toEqual({ ok: false, reason: 'bad-version' });
  });

  it.each([['missing', null], ['empty', ''], ['fractional', '1700000000.5'], ['exponent', '1.7e9'], ['negative', '-5'], ['words', 'now'], ['hex', '0x1F']])(
    'refuses a %s timestamp as bad-timestamp',
    (_label, value) => {
      const entries: Record<string, string> = { [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: 'v1' };
      if (value !== null) entries[INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER] = value;
      expect(precheck(entries)).toEqual({ ok: false, reason: 'bad-timestamp' });
    },
  );

  it('refuses a timestamp older than the replay window as expired and one ahead of it as future', () => {
    const at = (timestampSec: number) =>
      precheck({
        [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: 'v1',
        [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(timestampSec),
      });
    expect(at(NOW - WINDOW - 1)).toEqual({ ok: false, reason: 'expired' });
    expect(at(NOW + WINDOW + 1)).toEqual({ ok: false, reason: 'future' });
    expect(at(NOW - WINDOW)).toMatchObject({ ok: true });
    expect(at(NOW + WINDOW)).toMatchObject({ ok: true });
  });

  it('reads the operation-id profile headers, not the compact profile ones', () => {
    expect(
      precheck({ [INTERNAL_AUTH_VERSION_HEADER]: 'v1', [INTERNAL_AUTH_TIMESTAMP_HEADER]: String(NOW) }),
    ).toEqual({ ok: false, reason: 'bad-version' });
  });

  it('takes any structural header source, not only a Headers instance', () => {
    const plain = {
      get: (name: string) =>
        ({ [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: 'v1', [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(NOW) })[name] ??
        null,
    };
    expect(precheckInternalHeaders(plain, { nowSec: NOW, replayWindowSec: WINDOW })).toMatchObject({ ok: true });
  });

  it('applies the same rule as the full verify: same answer for every signed timestamp and clock', async () => {
    const fields: InternalRequestFields = {
      audience: 'example-audience:test',
      method: 'POST',
      path: '/internal/example',
      bodyHash: 'a'.repeat(64),
      operationId: 'op-1',
      timestampSec: NOW,
    };
    const sig = await signInternalRequest(fields, SECRET);
    for (const nowSec of [NOW - WINDOW - 1, NOW - WINDOW, NOW, NOW + WINDOW, NOW + WINDOW + 1]) {
      const pre = precheckInternalHeaders(
        headersOf({
          [INTERNAL_AUTH_OPERATION_VERSION_HEADER]: sig.version,
          [INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER]: String(sig.timestampSec),
        }),
        { nowSec, replayWindowSec: WINDOW },
      );
      const full = await verifyInternalRequest(
        { ...fields, version: sig.version, signature: sig.signature, nowSec, replayWindowSec: WINDOW },
        SECRET,
      );
      if (pre.ok) {
        expect(full).toEqual({ ok: true });
        const fromPrecheck = await verifyInternalRequest(
          { ...fields, version: pre.version, timestampSec: pre.timestampSec, signature: sig.signature, nowSec, replayWindowSec: WINDOW },
          SECRET,
        );
        expect(fromPrecheck).toEqual({ ok: true });
      } else {
        expect(full).toEqual(pre);
      }
    }
  });
});
