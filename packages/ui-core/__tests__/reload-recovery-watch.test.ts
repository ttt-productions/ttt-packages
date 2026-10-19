// The watch records the first failure only a reload repairs, from an `error` or an
// `unhandledrejection` event, and tells its subscribers once. It only listens: no event it sees is
// prevented, so monitoring still captures each one. Any other failure records nothing.

import { describe, it, expect, vi } from 'vitest';
import {
  createReloadRecoveryWatch,
  type ReloadRecoveryTarget,
} from '../src/browser/reload-recovery-watch.js';

const DISCONNECT = new DOMException(
  'Connection to Indexed Database server lost. Refresh the page to try again',
  'UnknownError',
);

function page() {
  const target = new EventTarget();
  return { target, watchTarget: target as unknown as ReloadRecoveryTarget };
}

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason });
}

function errorEvent(init: ErrorEventInit): ErrorEvent {
  return new ErrorEvent('error', { cancelable: true, ...init });
}

describe('createReloadRecoveryWatch', () => {
  it('records a lost storage connection from an unhandled rejection, leaving the event unprevented', () => {
    const { target, watchTarget } = page();
    const watch = createReloadRecoveryWatch(watchTarget);
    const event = rejection(DISCONNECT);
    target.dispatchEvent(event);
    expect(watch.current()).toBe('storageDisconnect');
    expect(event.defaultPrevented).toBe(false);
  });

  it('records a stale chunk from an error event, by its error or by its message alone', () => {
    const first = page();
    const byError = createReloadRecoveryWatch(first.watchTarget);
    const event = errorEvent({
      error: new Error('Failed to load chunk 3'),
      message: 'Uncaught Error',
    });
    first.target.dispatchEvent(event);
    expect(byError.current()).toBe('staleChunk');
    expect(event.defaultPrevented).toBe(false);

    const second = page();
    const byMessage = createReloadRecoveryWatch(second.watchTarget);
    second.target.dispatchEvent(errorEvent({ message: 'Uncaught Error: Failed to load chunk 3' }));
    expect(byMessage.current()).toBe('staleChunk');
  });

  it('records nothing for any other failure', () => {
    const { target, watchTarget } = page();
    const watch = createReloadRecoveryWatch(watchTarget);
    target.dispatchEvent(rejection(new TypeError('Failed to fetch')));
    target.dispatchEvent(errorEvent({ error: new Error('boom'), message: 'Uncaught Error: boom' }));
    expect(watch.current()).toBeNull();
  });

  it('keeps the first failure, telling its subscribers once, whatever follows', () => {
    const { target, watchTarget } = page();
    const watch = createReloadRecoveryWatch(watchTarget);
    const listener = vi.fn();
    watch.subscribe(listener);
    target.dispatchEvent(rejection(DISCONNECT));
    target.dispatchEvent(rejection(DISCONNECT));
    target.dispatchEvent(errorEvent({ error: new Error('Failed to load chunk 3') }));
    expect(watch.current()).toBe('storageDisconnect');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops listening when stopped, keeping what it recorded', () => {
    const { target, watchTarget } = page();
    const watch = createReloadRecoveryWatch(watchTarget);
    watch.stop();
    target.dispatchEvent(rejection(DISCONNECT));
    expect(watch.current()).toBeNull();
  });
});
