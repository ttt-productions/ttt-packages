import { describe, it, expect } from 'vitest';
import { buildSafeEvent, DEFAULT_SAFE_EVENT_KEYS } from '../src/safe-event.js';

describe('buildSafeEvent — allowlist', () => {
  it('keeps only the default allowlisted keys and drops everything else', () => {
    const out = buildSafeEvent({
      caseId: 'case_123',
      phase: 'review',
      safeCode: 'E-DENY',
      traceId: 't-abc',
      fileUrl: 'https://storage.example.test/private-bucket/x',
      clientIp: '203.0.113.7',
      digest: '0123456789abcdef'.repeat(4),
      vendorKey: 'vendorx-key-abcdef0123456789',
      reportXml: '<report>secret</report>',
      content: 'do not leak',
    });

    expect(out).toEqual({
      caseId: 'case_123',
      phase: 'review',
      safeCode: 'E-DENY',
      traceId: 't-abc',
    });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('private-bucket');
    expect(serialized).not.toContain('203.0.113.7');
    expect(serialized).not.toContain('0123456789abcdef'.repeat(4));
    expect(serialized).not.toContain('vendorx-key');
    expect(serialized).not.toContain('report');
    expect(serialized).not.toContain('do not leak');
  });

  it('drops allowlisted keys whose value is undefined by default', () => {
    const out = buildSafeEvent({ caseId: 'c1', phase: undefined, safeCode: 'X' });
    expect(out).toEqual({ caseId: 'c1', safeCode: 'X' });
    expect('phase' in out).toBe(false);
  });

  it('keeps undefined allowlisted keys when keepUndefined is true', () => {
    const out = buildSafeEvent({ caseId: 'c1', phase: undefined }, { keepUndefined: true });
    expect('phase' in out).toBe(true);
    expect(out.phase).toBeUndefined();
  });

  it('returns a fresh object, never the input', () => {
    const input = { caseId: 'c1' };
    const out = buildSafeEvent(input);
    expect(out).not.toBe(input);
  });

  it('supports a custom allowlist', () => {
    const out = buildSafeEvent(
      { caseId: 'c1', region: 'us-central1', secret: 'nope' },
      { allowedKeys: [...DEFAULT_SAFE_EVENT_KEYS, 'region'] },
    );
    expect(out).toEqual({ caseId: 'c1', region: 'us-central1' });
    expect('secret' in out).toBe(false);
  });

  it('returns an empty object for non-object input', () => {
    expect(buildSafeEvent(null)).toEqual({});
    expect(buildSafeEvent('string')).toEqual({});
    expect(buildSafeEvent(42)).toEqual({});
    expect(buildSafeEvent(undefined)).toEqual({});
  });

  it('ignores inherited (non-own) properties', () => {
    const proto = { caseId: 'inherited' };
    const obj = Object.create(proto) as Record<string, unknown>;
    obj.phase = 'own';
    const out = buildSafeEvent(obj);
    expect(out).toEqual({ phase: 'own' });
    expect('caseId' in out).toBe(false);
  });
});
