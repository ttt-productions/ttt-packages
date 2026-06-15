import { describe, it, expect } from 'vitest';
import { RealtimeMessageEnvelopeSchema, VersionedSyncItemSchema } from '../src/envelopes';
import { createReconnectController } from '../src/reconnect';
import { decideApply, applyVersioned, type StoredVersioned } from '../src/apply';
import { allocateNext, advanceFloor, recoveredFloor } from '../src/allocators';
import { REALTIME_ERROR_CODES, REALTIME_PROTOCOL_VERSION, isProtocolSupported } from '../src/protocol';

describe('protocol', () => {
  it('re-exports the edge protocol version + rolling-window check', () => {
    expect(REALTIME_PROTOCOL_VERSION).toBe(1);
    expect(isProtocolSupported(1)).toBe(true);
    expect(isProtocolSupported(99)).toBe(false);
  });
  it('exposes stable namespaced error codes', () => {
    expect(REALTIME_ERROR_CODES.GRANT_EXPIRED).toBe('realtime/grant-expired');
    expect(REALTIME_ERROR_CODES.NOT_FOUND_YET).toBe('realtime/not-found-yet');
  });
});

describe('envelopes', () => {
  it('parses a wire message envelope', () => {
    expect(RealtimeMessageEnvelopeSchema.safeParse({ v: 1, kind: 'msg', seq: 5, clientMessageId: 'c1', payload: { t: 'hi' } }).success).toBe(true);
  });
  it('parses a versioned sync item', () => {
    expect(VersionedSyncItemSchema.safeParse({ eventId: 'e1', version: 2, payloadHash: 'h', payload: {}, tombstone: true }).success).toBe(true);
  });
});

describe('decideApply (versioned-apply wrapper)', () => {
  it('applies when there is no stored record', () => {
    expect(decideApply({ version: 1, payloadHash: 'a' }, null)).toBe('apply');
  });
  it('applies a strictly newer version', () => {
    expect(decideApply({ version: 3, payloadHash: 'b' }, { version: 2, payloadHash: 'a' })).toBe('apply');
  });
  it('idempotent on same version + same hash', () => {
    expect(decideApply({ version: 2, payloadHash: 'a' }, { version: 2, payloadHash: 'a' })).toBe('idempotent');
  });
  it('conflict on same version + different hash', () => {
    expect(decideApply({ version: 2, payloadHash: 'b' }, { version: 2, payloadHash: 'a' })).toBe('conflict');
  });
  it('stale on an older version', () => {
    expect(decideApply({ version: 1, payloadHash: 'a' }, { version: 2, payloadHash: 'b' })).toBe('stale');
  });
});

describe('applyVersioned', () => {
  it('writes only on apply', async () => {
    let stored: StoredVersioned | null = null;
    const written: unknown[] = [];
    const adapter = {
      read: () => stored,
      write: (item: { version: number; payloadHash: string }) => { stored = item; written.push(item); },
    };
    expect(await applyVersioned({ version: 1, payloadHash: 'a' }, adapter)).toBe('apply');
    expect(await applyVersioned({ version: 1, payloadHash: 'a' }, adapter)).toBe('idempotent');
    expect(await applyVersioned({ version: 1, payloadHash: 'b' }, adapter)).toBe('conflict');
    expect(await applyVersioned({ version: 2, payloadHash: 'c' }, adapter)).toBe('apply');
    expect(written.map((w) => (w as { version: number }).version)).toEqual([1, 2]); // conflict/idempotent did not write
  });
});

describe('reconnect controller', () => {
  it('grows backoff with a deterministic random, resets on open', () => {
    const c = createReconnectController({ baseDelayMs: 100, maxDelayMs: 10_000, random: () => 1 });
    c.start();
    expect(c.state).toBe('connecting');
    const d1 = c.onClose(); // attempt 1 → base*2^0 = 100
    expect(d1).toBe(100);
    const d2 = c.onClose(); // attempt 2 → base*2^1 = 200
    expect(d2).toBe(200);
    expect(c.attempt).toBe(2);
    c.onOpen();
    expect(c.state).toBe('open');
    expect(c.attempt).toBe(0);
  });

  it('full-jitter uses the injected random', () => {
    const c = createReconnectController({ baseDelayMs: 1000, random: () => 0.5 });
    c.start();
    expect(c.onClose()).toBe(500); // floor(0.5 * 1000)
  });

  it('caps delay at maxDelayMs', () => {
    const c = createReconnectController({ baseDelayMs: 1000, maxDelayMs: 1500, random: () => 1 });
    c.start();
    c.onClose(); // 1000
    expect(c.onClose()).toBe(1500); // 2000 capped to 1500
  });

  it('closes after maxAttempts', () => {
    const c = createReconnectController({ maxAttempts: 2, random: () => 1 });
    c.start();
    expect(c.onClose()).not.toBeNull();
    expect(c.onClose()).toBeNull();
    expect(c.state).toBe('closed');
  });
});

describe('monotonic allocators', () => {
  it('allocateNext increments from lastValue', () => {
    const a = allocateNext({ lastValue: 4 });
    expect(a.value).toBe(5);
    expect(a.next.lastValue).toBe(5);
  });
  it('advanceFloor never regresses', () => {
    expect(advanceFloor({ lastValue: 10 }, 5).lastValue).toBe(10);
    expect(advanceFloor({ lastValue: 3 }, 9).lastValue).toBe(9);
  });
  it('recoveredFloor takes the max of all inputs', () => {
    expect(recoveredFloor(3, null, 7, undefined, 5)).toBe(7);
    expect(recoveredFloor(null, undefined)).toBe(0);
  });
});
