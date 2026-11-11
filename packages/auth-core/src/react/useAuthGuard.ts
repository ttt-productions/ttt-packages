'use client';

import { useEffect, useRef } from 'react';
import { readStoredValue, writeStoredValue } from '@ttt-productions/storage-core';

export interface AuthGuardConfig {
  publicRoutes: string[];
  authRedirectRoutes: string[];
  loginRoute: string;
  defaultRoute: string;
  rootRedirect?: { authenticated: string; unauthenticated: string };
  redirectKey: string;
  replace: (path: string) => void;
  pathname: string;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuthGuard(config: AuthGuardConfig): void {
  const {
    publicRoutes,
    authRedirectRoutes,
    loginRoute,
    defaultRoute,
    rootRedirect,
    redirectKey,
    replace,
    pathname,
    loading,
    isAuthenticated,
  } = config;

  // The router commits a navigation asynchronously, so this effect can re-run on the auth route
  // after the key is consumed; the latch stops a second replace clobbering it.
  const authRouteRedirected = useRef(false);

  const lastAuthenticated = useRef<boolean | null>(null);
  const sessionEndedOn = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (lastAuthenticated.current === true && !isAuthenticated) {
      sessionEndedOn.current = pathname;
      writeStoredValue(redirectKey, null);
    } else if (isAuthenticated || sessionEndedOn.current !== pathname) {
      sessionEndedOn.current = null;
    }
    lastAuthenticated.current = isAuthenticated;

    if (!authRedirectRoutes.includes(pathname)) {
      authRouteRedirected.current = false;
    }

    if (rootRedirect && pathname === '/') {
      replace(isAuthenticated ? rootRedirect.authenticated : rootRedirect.unauthenticated);
      return;
    }

    const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
    const isAuthRedirect = authRedirectRoutes.includes(pathname);

    if (!isAuthenticated && !isPublic) {
      if (sessionEndedOn.current === null) writeStoredValue(redirectKey, pathname);
      replace(loginRoute);
      return;
    }

    if (isAuthenticated && isAuthRedirect) {
      if (authRouteRedirected.current) return;
      authRouteRedirected.current = true;
      let target = defaultRoute;
      const saved = readStoredValue(redirectKey);
      if (saved && !authRedirectRoutes.includes(saved)) {
        target = saved;
      }
      writeStoredValue(redirectKey, null);
      replace(target);
    }
  }, [
    loading,
    isAuthenticated,
    pathname,
    publicRoutes,
    authRedirectRoutes,
    loginRoute,
    defaultRoute,
    rootRedirect,
    redirectKey,
    replace,
  ]);
}
