// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { Analytics, AnalyticsCallOptions } from 'firebase/analytics';

const h = vi.hoisted(() => ({
  logEvent:
    vi.fn<
      (
        analytics: Analytics,
        eventName: string,
        eventParams?: object,
        options?: AnalyticsCallOptions,
      ) => void
    >(),
  setUserId: vi.fn<typeof import('firebase/analytics').setUserId>(),
  setUserProperties: vi.fn<typeof import('firebase/analytics').setUserProperties>(),
}));

vi.mock(import('firebase/analytics'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  return passThroughModule(importOriginal, {
    logEvent: h.logEvent,
    setUserId: h.setUserId,
    setUserProperties: h.setUserProperties,
  });
});

import {
  FirebaseAnalyticsIdentity,
  FirebaseAnalyticsPageViews,
  useFirebaseAnalyticsEvents,
} from '../src/react/firebase-analytics.js';
import type { FirebaseAnalyticsHandle } from '../src/client/firebase-init.js';

const instance: Analytics = {
  app: { name: 'test', options: {}, automaticDataCollectionEnabled: false },
};

function fakeHandle(created = true) {
  let current: Analytics | undefined = created ? instance : undefined;
  const listeners = new Set<() => void>();
  const handle: FirebaseAnalyticsHandle = {
    get: () => current,
    enable: () => current,
    setCollectionEnabled: () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const create = () => {
    current = instance;
    for (const listener of listeners) listener();
  };
  return { handle, create };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFirebaseAnalyticsEvents', () => {
  it('logs an event while analytics is enabled and created', () => {
    const { handle } = fakeHandle();
    const { result } = renderHook(() => useFirebaseAnalyticsEvents(handle, true));
    result.current('signed_up', { a: 1 });
    expect(h.logEvent).toHaveBeenCalledWith(instance, 'signed_up', { a: 1 });
  });

  it('logs nothing without consent', () => {
    const { handle } = fakeHandle();
    const { result } = renderHook(() => useFirebaseAnalyticsEvents(handle, false));
    result.current('signed_up');
    expect(h.logEvent).not.toHaveBeenCalled();
  });

  it('logs nothing before analytics exists', () => {
    const { handle } = fakeHandle(false);
    const { result } = renderHook(() => useFirebaseAnalyticsEvents(handle, true));
    result.current('signed_up');
    expect(h.logEvent).not.toHaveBeenCalled();
  });
});

describe('FirebaseAnalyticsPageViews', () => {
  const pageViews = () => h.logEvent.mock.calls.filter((call) => call[1] === 'page_view');

  it('counts the entry page once analytics is enabled', () => {
    const { handle } = fakeHandle();
    render(<FirebaseAnalyticsPageViews handle={handle} enabled pathname="/hall" />);
    expect(pageViews()).toHaveLength(1);
    expect(pageViews()[0]![2]).toMatchObject({ page_path: '/hall' });
  });

  it('counts the page when the lazily created handle appears', () => {
    const { handle, create } = fakeHandle(false);
    render(<FirebaseAnalyticsPageViews handle={handle} enabled pathname="/hall" />);
    expect(pageViews()).toHaveLength(0);
    act(() => create());
    expect(pageViews()).toHaveLength(1);
    expect(pageViews()[0]![0]).toBe(instance);
  });

  it('withdrawing and re-enabling on the same page sends no second page_view', () => {
    const { handle } = fakeHandle();
    const { rerender } = render(
      <FirebaseAnalyticsPageViews handle={handle} enabled pathname="/hall" />,
    );
    rerender(<FirebaseAnalyticsPageViews handle={handle} enabled={false} pathname="/hall" />);
    rerender(<FirebaseAnalyticsPageViews handle={handle} enabled pathname="/hall" />);
    expect(pageViews()).toHaveLength(1);
  });

  it('counts each new page', () => {
    const { handle } = fakeHandle();
    const { rerender } = render(
      <FirebaseAnalyticsPageViews handle={handle} enabled pathname="/hall" />,
    );
    rerender(<FirebaseAnalyticsPageViews handle={handle} enabled pathname="/square" />);
    expect(pageViews().map((call) => (call[2] as { page_path: string }).page_path)).toEqual([
      '/hall',
      '/square',
    ]);
  });

  it('counts nothing without consent', () => {
    const { handle } = fakeHandle();
    render(<FirebaseAnalyticsPageViews handle={handle} enabled={false} pathname="/hall" />);
    expect(pageViews()).toHaveLength(0);
  });
});

describe('FirebaseAnalyticsIdentity', () => {
  const props = { account_created: '2024-01-01T00:00:00.000Z' };
  const propsB = { account_created: '2025-02-02T00:00:00.000Z' };

  it("attaches the signed-in account's identity at sign-in", () => {
    const { handle } = fakeHandle();
    const { rerender } = render(<FirebaseAnalyticsIdentity handle={handle} enabled uid={null} />);
    expect(h.setUserId).not.toHaveBeenCalledWith(instance, expect.any(String));
    rerender(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    expect(h.setUserId).toHaveBeenLastCalledWith(instance, 'user-a');
    expect(h.setUserProperties).toHaveBeenLastCalledWith(instance, props);
  });

  it('clears the identity and its properties when the session ends', () => {
    const { handle } = fakeHandle();
    const { rerender } = render(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    vi.clearAllMocks();
    rerender(<FirebaseAnalyticsIdentity handle={handle} enabled uid={null} />);
    expect(h.setUserId).toHaveBeenCalledExactlyOnceWith(instance, null);
    expect(h.setUserProperties).toHaveBeenCalledWith(instance, { account_created: null });
  });

  it('clears the previous account before it attaches the next one', () => {
    const { handle } = fakeHandle();
    const { rerender } = render(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    vi.clearAllMocks();
    rerender(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-b" userProperties={propsB} />,
    );
    expect(h.setUserId.mock.calls.map((call) => call[1])).toEqual([null, 'user-b']);
    expect(h.setUserProperties).toHaveBeenLastCalledWith(instance, propsB);
  });

  it('clears the identity when consent is withdrawn, and reattaches it when consent returns', () => {
    const { handle } = fakeHandle();
    const { rerender } = render(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    vi.clearAllMocks();
    rerender(
      <FirebaseAnalyticsIdentity
        handle={handle}
        enabled={false}
        uid="user-a"
        userProperties={props}
      />,
    );
    expect(h.setUserId).toHaveBeenCalledExactlyOnceWith(instance, null);
    expect(h.setUserProperties).toHaveBeenCalledWith(instance, { account_created: null });

    vi.clearAllMocks();
    rerender(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    expect(h.setUserId).toHaveBeenLastCalledWith(instance, 'user-a');
  });

  it('does nothing when analytics never started', () => {
    const { handle } = fakeHandle(false);
    render(
      <FirebaseAnalyticsIdentity handle={handle} enabled uid="user-a" userProperties={props} />,
    );
    expect(h.setUserId).not.toHaveBeenCalled();
    expect(h.setUserProperties).not.toHaveBeenCalled();
  });
});
