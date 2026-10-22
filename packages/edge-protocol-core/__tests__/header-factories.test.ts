import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../src/payload-hash.js';
import {
  signInternalRequest,
  verifyInternalRequest,
  type InternalRequestFields,
} from '../src/internal-auth.js';
import { defineProvenanceHeaders } from '../src/provenance-headers.js';
import { defineInternalAuthHeaders } from '../src/internal-auth-headers.js';

const PROVENANCE_CONFIG = {
  originMarker: { name: 'x-example-origin', value: 'o1' },
  edgeMarker: { name: 'x-example-edge', value: 'e1' },
  edgeSecret: 'x-example-secret',
  canonicalHost: 'x-example-host',
  clientIp: 'x-example-ip',
  verifiedClientIp: 'x-example-verified-ip',
};

const INTERNAL_CONFIG = {
  operationId: 'x-example-op',
  timestamp: 'x-example-ts',
  version: 'x-example-ver',
  signature: 'x-example-sig',
};

describe('defineProvenanceHeaders', () => {
  it('returns exactly the names and marker values it is given', () => {
    const h = defineProvenanceHeaders(PROVENANCE_CONFIG);
    expect(h.originMarker).toEqual({ name: 'x-example-origin', value: 'o1' });
    expect(h.edgeMarker).toEqual({ name: 'x-example-edge', value: 'e1' });
    expect(h.edgeSecret).toBe('x-example-secret');
    expect(h.canonicalHost).toBe('x-example-host');
    expect(h.clientIp).toBe('x-example-ip');
    expect(h.verifiedClientIp).toBe('x-example-verified-ip');
  });

  it('derives the internal set from every name but the edge marker', () => {
    const h = defineProvenanceHeaders(PROVENANCE_CONFIG);
    expect([...h.internalHeaders].sort()).toEqual(
      [
        'x-example-secret',
        'x-example-host',
        'x-example-ip',
        'x-example-verified-ip',
        'x-example-origin',
      ].sort(),
    );
    expect(h.internalHeaders).not.toContain('x-example-edge');
  });

  it('deleting the internal set leaves only the other headers of a request', () => {
    const h = defineProvenanceHeaders(PROVENANCE_CONFIG);
    const inbound = new Headers({
      [h.edgeSecret]: 'a',
      [h.canonicalHost]: 'b.example',
      [h.clientIp]: '10.0.0.1',
      [h.verifiedClientIp]: '10.0.0.2',
      [h.originMarker.name]: h.originMarker.value,
      'user-agent': 'kept',
    });
    for (const name of h.internalHeaders) inbound.delete(name);
    expect([...inbound.keys()]).toEqual(['user-agent']);
  });

  it('freezes the result, its markers, and its internal set', () => {
    const h = defineProvenanceHeaders(PROVENANCE_CONFIG);
    expect(Object.isFrozen(h)).toBe(true);
    expect(Object.isFrozen(h.originMarker)).toBe(true);
    expect(Object.isFrozen(h.edgeMarker)).toBe(true);
    expect(Object.isFrozen(h.internalHeaders)).toBe(true);
  });

  it('keeps its values when the config object changes afterwards', () => {
    const config = structuredClone(PROVENANCE_CONFIG);
    const h = defineProvenanceHeaders(config);
    config.originMarker.value = 'changed';
    config.edgeSecret = 'x-example-changed';
    expect(h.originMarker.value).toBe('o1');
    expect(h.edgeSecret).toBe('x-example-secret');
  });

  it.each(['X-Example-Secret', 'x_example', 'x example', ''])(
    'refuses the header name %j',
    (name) => {
      expect(() => defineProvenanceHeaders({ ...PROVENANCE_CONFIG, edgeSecret: name })).toThrow(
        TypeError,
      );
      expect(() =>
        defineProvenanceHeaders({ ...PROVENANCE_CONFIG, originMarker: { name, value: 'o1' } }),
      ).toThrow(TypeError);
    },
  );

  it.each(['', 'a b', 'a\r\nb'])('refuses the marker value %j', (value) => {
    expect(() =>
      defineProvenanceHeaders({
        ...PROVENANCE_CONFIG,
        edgeMarker: { name: 'x-example-edge', value },
      }),
    ).toThrow(TypeError);
  });

  it('refuses two headers that share a name', () => {
    expect(() =>
      defineProvenanceHeaders({ ...PROVENANCE_CONFIG, verifiedClientIp: 'x-example-ip' }),
    ).toThrow(TypeError);
    expect(() =>
      defineProvenanceHeaders({
        ...PROVENANCE_CONFIG,
        edgeMarker: { name: 'x-example-origin', value: 'e1' },
      }),
    ).toThrow(TypeError);
  });
});

describe('defineInternalAuthHeaders', () => {
  it('returns exactly the names it is given, frozen, with an operation id', () => {
    const names = defineInternalAuthHeaders(INTERNAL_CONFIG);
    expect(names).toEqual(INTERNAL_CONFIG);
    expect(Object.isFrozen(names)).toBe(true);
  });

  it('accepts a profile without an operation id', () => {
    const { operationId: _omitted, ...withoutId } = INTERNAL_CONFIG;
    expect(defineInternalAuthHeaders(withoutId)).toEqual(withoutId);
  });

  it('keeps its values when the config object changes afterwards', () => {
    const config = { ...INTERNAL_CONFIG };
    const names = defineInternalAuthHeaders(config);
    config.signature = 'x-example-changed';
    expect(names.signature).toBe('x-example-sig');
  });

  it.each(['X-Example-Sig', 'x_example', ''])('refuses the header name %j', (name) => {
    expect(() => defineInternalAuthHeaders({ ...INTERNAL_CONFIG, signature: name })).toThrow(
      TypeError,
    );
    expect(() => defineInternalAuthHeaders({ ...INTERNAL_CONFIG, operationId: name })).toThrow(
      TypeError,
    );
  });

  it('refuses two fields that share a name, the operation id included', () => {
    expect(() =>
      defineInternalAuthHeaders({ ...INTERNAL_CONFIG, version: 'x-example-ts' }),
    ).toThrow(TypeError);
    expect(() =>
      defineInternalAuthHeaders({ ...INTERNAL_CONFIG, operationId: 'x-example-sig' }),
    ).toThrow(TypeError);
  });

  it('carries a signature through its headers to a successful verify', async () => {
    const names = defineInternalAuthHeaders(INTERNAL_CONFIG);
    const secret = 'test-secret';
    const fields: InternalRequestFields = {
      audience: 'svc-a:test',
      method: 'POST',
      path: '/internal/example',
      bodyHash: await sha256Hex('{"id":"a1"}'),
      operationId: 'op-1',
      timestampSec: 1_800_000_000,
    };
    const sig = await signInternalRequest(fields, secret);
    const headers = new Headers({
      [names.operationId]: fields.operationId,
      [names.timestamp]: String(sig.timestampSec),
      [names.version]: sig.version,
      [names.signature]: sig.signature,
    });

    const verified = await verifyInternalRequest(
      {
        audience: fields.audience,
        method: fields.method,
        path: fields.path,
        bodyHash: fields.bodyHash,
        operationId: headers.get(names.operationId) ?? '',
        timestampSec: Number(headers.get(names.timestamp) ?? 'NaN'),
        version: headers.get(names.version) ?? '',
        signature: headers.get(names.signature) ?? '',
        nowSec: fields.timestampSec + 5,
        replayWindowSec: 300,
      },
      secret,
    );
    expect(verified).toEqual({ ok: true });
  });
});
