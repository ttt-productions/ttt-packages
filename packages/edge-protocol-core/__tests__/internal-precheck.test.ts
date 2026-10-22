import { describe, it, expect } from 'vitest';
import {
  precheckInternalHeaders,
  signInternalRequest,
  verifyInternalRequest,
  type InternalRequestFields,
} from '../src/internal-auth.js';
import { defineInternalAuthHeaders } from '../src/internal-auth-headers.js';

const NOW = 1_700_000_000;
const WINDOW = 300;
const SECRET = 'test-secret';

const NAMES = defineInternalAuthHeaders({
  operationId: 'x-example-op',
  timestamp: 'x-example-ts',
  version: 'x-example-ver',
  signature: 'x-example-sig',
});
const OTHER = defineInternalAuthHeaders({
  timestamp: 'x-example-other-ts',
  version: 'x-example-other-ver',
  signature: 'x-example-other-sig',
});
const VERSION = NAMES.version;
const TIMESTAMP = NAMES.timestamp;

function headersOf(entries: Record<string, string>) {
  return new Headers(entries);
}

function precheck(entries: Record<string, string>, nowSec = NOW) {
  return precheckInternalHeaders(headersOf(entries), NAMES, { nowSec, replayWindowSec: WINDOW });
}

describe('precheckInternalHeaders', () => {
  it('accepts the signing version with an in-window timestamp and hands back both values', () => {
    expect(
      precheck({
        [VERSION]: 'v1',
        [TIMESTAMP]: String(NOW - 10),
      }),
    ).toEqual({ ok: true, version: 'v1', timestampSec: NOW - 10 });
  });

  it('refuses a missing or unknown signing version', () => {
    expect(precheck({ [TIMESTAMP]: String(NOW) })).toEqual({
      ok: false,
      reason: 'bad-version',
    });
    expect(
      precheck({
        [VERSION]: 'v2',
        [TIMESTAMP]: String(NOW),
      }),
    ).toEqual({ ok: false, reason: 'bad-version' });
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['fractional', '1700000000.5'],
    ['exponent', '1.7e9'],
    ['negative', '-5'],
    ['words', 'now'],
    ['hex', '0x1F'],
  ])('refuses a %s timestamp as bad-timestamp', (_label, value) => {
    const entries: Record<string, string> = { [VERSION]: 'v1' };
    if (value !== null) entries[TIMESTAMP] = value;
    expect(precheck(entries)).toEqual({ ok: false, reason: 'bad-timestamp' });
  });

  it('refuses a timestamp older than the replay window as expired and one ahead of it as future', () => {
    const at = (timestampSec: number) =>
      precheck({
        [VERSION]: 'v1',
        [TIMESTAMP]: String(timestampSec),
      });
    expect(at(NOW - WINDOW - 1)).toEqual({ ok: false, reason: 'expired' });
    expect(at(NOW + WINDOW + 1)).toEqual({ ok: false, reason: 'future' });
    expect(at(NOW - WINDOW)).toMatchObject({ ok: true });
    expect(at(NOW + WINDOW)).toMatchObject({ ok: true });
  });

  it('reads the header names it is given and no others', () => {
    const entries = { [OTHER.version]: 'v1', [OTHER.timestamp]: String(NOW) };
    expect(precheck(entries)).toEqual({ ok: false, reason: 'bad-version' });
    expect(
      precheckInternalHeaders(headersOf(entries), OTHER, { nowSec: NOW, replayWindowSec: WINDOW }),
    ).toEqual({ ok: true, version: 'v1', timestampSec: NOW });
  });

  it('takes any structural header source, not only a Headers instance', () => {
    const plain = {
      get: (name: string) =>
        ({
          [VERSION]: 'v1',
          [TIMESTAMP]: String(NOW),
        })[name] ?? null,
    };
    expect(
      precheckInternalHeaders(plain, NAMES, { nowSec: NOW, replayWindowSec: WINDOW }),
    ).toMatchObject({ ok: true });
  });

  it('applies the same rule as the full verify: same answer for every signed timestamp and clock', async () => {
    const fields: InternalRequestFields = {
      audience: 'svc-a:test',
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
          [VERSION]: sig.version,
          [TIMESTAMP]: String(sig.timestampSec),
        }),
        NAMES,
        { nowSec, replayWindowSec: WINDOW },
      );
      const full = await verifyInternalRequest(
        {
          ...fields,
          version: sig.version,
          signature: sig.signature,
          nowSec,
          replayWindowSec: WINDOW,
        },
        SECRET,
      );
      if (pre.ok) {
        expect(full).toEqual({ ok: true });
        const fromPrecheck = await verifyInternalRequest(
          {
            ...fields,
            version: pre.version,
            timestampSec: pre.timestampSec,
            signature: sig.signature,
            nowSec,
            replayWindowSec: WINDOW,
          },
          SECRET,
        );
        expect(fromPrecheck).toEqual({ ok: true });
      } else {
        expect(full).toEqual(pre);
      }
    }
  });
});
