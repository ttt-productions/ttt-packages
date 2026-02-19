import { describe, it, expect, beforeAll } from 'vitest';
import { initMonitoring } from '../src/init';
import {
  captureException,
  captureMessage,
  setUser,
  setTag,
  withScope,
  addBreadcrumb,
} from '../src/api';

beforeAll(async () => {
  await initMonitoring({ provider: 'noop', enabled: true }, true);
});

describe('captureException', () => {
  it('does not throw for an Error', () => {
    expect(() => captureException(new Error('test error'))).not.toThrow();
  });

  it('does not throw for a string', () => {
    expect(() => captureException('string error')).not.toThrow();
  });

  it('does not throw for null', () => {
    expect(() => captureException(null)).not.toThrow();
  });

  it('does not throw with context', () => {
    expect(() =>
      captureException(new Error('test'), { userId: 'abc', action: 'upload' })
    ).not.toThrow();
  });
});

describe('captureMessage', () => {
  it('does not throw for a simple message', () => {
    expect(() => captureMessage('hello world')).not.toThrow();
  });

  it('does not throw with level "error"', () => {
    expect(() => captureMessage('something broke', 'error')).not.toThrow();
  });

  it('does not throw with level "info"', () => {
    expect(() => captureMessage('info message', 'info')).not.toThrow();
  });

  it('does not throw with level "warning"', () => {
    expect(() => captureMessage('warning', 'warning')).not.toThrow();
  });

  it('does not throw with level "debug"', () => {
    expect(() => captureMessage('debug info', 'debug')).not.toThrow();
  });
});

describe('setUser', () => {
  it('does not throw when setting a user', () => {
    expect(() => setUser({ id: 'uid-123', email: 'test@example.com' })).not.toThrow();
  });

  it('does not throw when clearing the user (null)', () => {
    expect(() => setUser(null)).not.toThrow();
  });

  it('does not throw with partial user data', () => {
    expect(() => setUser({ id: 'uid-123' })).not.toThrow();
    expect(() => setUser({ email: 'test@example.com' })).not.toThrow();
    expect(() => setUser({ username: 'testuser' })).not.toThrow();
  });
});

describe('setTag', () => {
  it('does not throw when setting a tag', () => {
    expect(() => setTag('environment', 'production')).not.toThrow();
    expect(() => setTag('version', '1.2.3')).not.toThrow();
  });
});

describe('withScope', () => {
  it('does not throw', () => {
    expect(() => withScope(() => {})).not.toThrow();
  });

  it('calls the callback and returns its result', () => {
    const result = withScope(() => 42);
    expect(result).toBe(42);
  });

  it('callback receives a scope-like object', () => {
    withScope((scope) => {
      expect(scope).toBeDefined();
      expect(typeof scope.setTag).toBe('function');
      expect(typeof scope.setUser).toBe('function');
    });
  });

  it('scope methods do not throw', () => {
    withScope((scope) => {
      expect(() => scope.setTag('key', 'value')).not.toThrow();
      expect(() => scope.setUser(null)).not.toThrow();
    });
  });
});

describe('addBreadcrumb', () => {
  it('does not throw for a complete breadcrumb', () => {
    expect(() =>
      addBreadcrumb({
        category: 'navigation',
        message: 'User navigated to /home',
        level: 'info',
        data: { from: '/login' },
      })
    ).not.toThrow();
  });

  it('does not throw for a minimal breadcrumb', () => {
    expect(() => addBreadcrumb({})).not.toThrow();
  });

  it('does not throw with only a message', () => {
    expect(() => addBreadcrumb({ message: 'Something happened' })).not.toThrow();
  });
});
