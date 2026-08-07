import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAuthGuard, type AuthGuardConfig } from '../src/react/useAuthGuard.js';

const KEY = 'auth_redirect_path';

function makeConfig(overrides: Partial<AuthGuardConfig> = {}): AuthGuardConfig {
  return {
    publicRoutes: ['/login', '/register', '/terms'],
    authRedirectRoutes: ['/login', '/register'],
    loginRoute: '/login',
    defaultRoute: '/landing',
    replace: vi.fn(),
    pathname: '/login',
    loading: false,
    isAuthenticated: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('useAuthGuard', () => {
  it('unauthenticated on a protected route saves the path and redirects to login', () => {
    const replace = vi.fn();
    renderHook(() => useAuthGuard(makeConfig({ pathname: '/profile', replace })));
    expect(localStorage.getItem(KEY)).toBe('/profile');
    expect(replace).toHaveBeenCalledWith('/login');
  });

  describe('publicRoutes is the SOLE source of public routes (no built-in literals)', () => {
    it('a configured prefix makes every path beneath it public while signed out', () => {
      // Prefix semantics: one '/v/' entry covers every '/v/:id' share link, which is
      // exactly what a previously hardcoded '/v/' literal did inside the hook.
      const replace = vi.fn();
      renderHook(() =>
        useAuthGuard(
          makeConfig({
            publicRoutes: ['/login', '/register', '/terms', '/v/'],
            pathname: '/v/abc123',
            replace,
          }),
        ),
      );
      expect(replace).not.toHaveBeenCalled();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('NO hidden default: the same path is protected when its prefix is NOT configured', () => {
      // Regression guard for the removed in-hook '/v/' literal. If any implicit
      // public route creeps back in, this redirect stops happening.
      const replace = vi.fn();
      renderHook(() => useAuthGuard(makeConfig({ pathname: '/v/abc123', replace })));
      expect(localStorage.getItem(KEY)).toBe('/v/abc123');
      expect(replace).toHaveBeenCalledWith('/login');
    });

    it('an empty publicRoutes list leaves every non-root path protected', () => {
      const replace = vi.fn();
      renderHook(() =>
        useAuthGuard(makeConfig({ publicRoutes: [], pathname: '/terms', replace })),
      );
      expect(replace).toHaveBeenCalledWith('/login');
    });

    it('the prefix rule is app-agnostic — any configured prefix behaves the same way', () => {
      const replace = vi.fn();
      renderHook(() =>
        useAuthGuard(
          makeConfig({ publicRoutes: ['/share/'], pathname: '/share/xyz/detail', replace }),
        ),
      );
      expect(replace).not.toHaveBeenCalled();
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  it('authenticated on an auth route consumes the saved path', () => {
    localStorage.setItem(KEY, '/v/abc123');
    const replace = vi.fn();
    renderHook(() => useAuthGuard(makeConfig({ isAuthenticated: true, replace })));
    expect(replace).toHaveBeenCalledWith('/v/abc123');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('authenticated on an auth route with no saved path goes to defaultRoute', () => {
    const replace = vi.fn();
    renderHook(() => useAuthGuard(makeConfig({ isAuthenticated: true, replace })));
    expect(replace).toHaveBeenCalledWith('/landing');
  });

  it('SINGLE-SHOT: a re-run on the auth route never clobbers the consumed-path navigation with defaultRoute', () => {
    // The consuming redirect navigates asynchronously, so the effect can re-run
    // (loading flap / auth re-render) while pathname still reads the auth route —
    // with the key already consumed, a second replace(defaultRoute) would clobber
    // the in-flight saved-path navigation.
    localStorage.setItem(KEY, '/v/abc123');
    const replace = vi.fn();
    const { rerender } = renderHook((props: { loading: boolean }) =>
      useAuthGuard(makeConfig({ isAuthenticated: true, loading: props.loading, replace })),
    { initialProps: { loading: false } });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/v/abc123');
    // Loading flap re-runs the effect on the SAME pathname — must not re-replace.
    rerender({ loading: true });
    rerender({ loading: false });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('the latch resets once the pathname leaves the auth-route set', () => {
    localStorage.setItem(KEY, '/v/abc123');
    const replace = vi.fn();
    const { rerender } = renderHook((props: { pathname: string }) =>
      useAuthGuard(makeConfig({ isAuthenticated: true, pathname: props.pathname, replace })),
    { initialProps: { pathname: '/login' } });
    expect(replace).toHaveBeenNthCalledWith(1, '/v/abc123');
    // Navigation committed (pathname left the auth route), then a later authed
    // visit to /login redirects normally again.
    rerender({ pathname: '/v/abc123' });
    rerender({ pathname: '/login' });
    expect(replace).toHaveBeenNthCalledWith(2, '/landing');
  });

  it('a saved path pointing at an auth route is ignored (defaultRoute wins)', () => {
    localStorage.setItem(KEY, '/register');
    const replace = vi.fn();
    renderHook(() => useAuthGuard(makeConfig({ isAuthenticated: true, replace })));
    expect(replace).toHaveBeenCalledWith('/landing');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
