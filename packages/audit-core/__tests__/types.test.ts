import { describe, it, expect } from 'vitest';
import type { AuditEvent } from '../src/types.js';

// Compile-time test: AuditEvent with explicit generics compiles cleanly.
const validEvent: AuditEvent<'user.login' | 'user.logout', string, string, { ip: string }> = {
  id: 'abc',
  type: 'user.login',
  schemaVersion: 1,
  actor: 'user123',
  target: 'session-xyz',
  timestamp: Date.now(),
  ip: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
  region: 'us-east-1',
  metadata: { ip: '1.2.3.4' },
  result: 'success',
  failureReason: null,
  correlationId: null,
};

describe('AuditEvent type', () => {
  it('compiles with correct generic parameters', () => {
    expect(validEvent.type).toBe('user.login');
    expect(validEvent.result).toBe('success');
  });

  it('@ts-expect-error confirms TEventType constraint is enforced', () => {
    // @ts-expect-error — 'unknown.event' is not assignable to 'user.login' | 'user.logout'
    const bad: AuditEvent<'user.login' | 'user.logout'> = { ...validEvent, type: 'unknown.event' };
    // Runtime value still exists — this is purely a compile-time assertion
    expect(bad).toBeDefined();
  });
});

export {};
