"use client";

import { useEffect, useRef } from "react";
import { clearRedirectPath, readRedirectPath, saveRedirectPath } from "./redirect-storage.js";

export interface AuthGuardConfig {
  /**
   * Routes accessible without authentication, matched by PREFIX
   * (`pathname.startsWith(entry)`), so `'/share/'` covers every `/share/:id`
   * beneath it and `'/terms'` covers `/terms/anything`. This is the SOLE source of public
   * routes — the hook has no built-in defaults and no app-specific literals, so
   * a consumer that needs a dynamic public section must list its prefix here.
   */
  publicRoutes: string[];
  /** Routes that redirect authenticated users away (login, register) */
  authRedirectRoutes: string[];
  /** Where unauthenticated users go */
  loginRoute: string;
  /** Where authenticated users go from authRedirectRoutes */
  defaultRoute: string;
  /** Special root path handling */
  rootRedirect?: { authenticated: string; unauthenticated: string };
  /** localStorage key for post-login redirect */
  redirectKey?: string;
  /** Navigation function (e.g. router.replace) */
  replace: (path: string) => void;
  /** Current path */
  pathname: string;
  /** From useAuth() */
  loading: boolean;
  /** From useAuth() */
  isAuthenticated: boolean;
}

const DEFAULT_REDIRECT_KEY = "auth_redirect_path";

/**
 * Handles route protection. Call in app shell component.
 *
 * - Does nothing while loading.
 * - Redirects unauthenticated users from protected routes to loginRoute.
 * - Redirects authenticated users from authRedirectRoutes to defaultRoute.
 * - Saves attempted path for post-login redirect — a visitor's deep link only. When a
 *   session ends (an observed signed-in → signed-out transition: a sign-out, a forced
 *   sign-out, an expiry, another tab), the path it ended on is NOT saved and any saved
 *   path is cleared, so the next account to sign in on this device never lands on the
 *   previous account's page.
 *
 * "Public" is decided ENTIRELY by `config.publicRoutes` (prefix match). The hook
 * carries no built-in or implicit public route: every route a consumer wants
 * reachable while signed out — including a dynamic section like `/share/:id` — is
 * listed by that consumer as a prefix.
 */
export function useAuthGuard(config: AuthGuardConfig): void {
  const {
    publicRoutes,
    authRedirectRoutes,
    loginRoute,
    defaultRoute,
    rootRedirect,
    redirectKey = DEFAULT_REDIRECT_KEY,
    replace,
    pathname,
    loading,
    isAuthenticated,
  } = config;

  // The auth-route redirect below is SINGLE-SHOT per auth-route visit. That branch
  // CONSUMES redirectKey and issues a navigation, but the navigation commits
  // asynchronously (the router fetches the target route first), so this effect can
  // legitimately re-run while pathname still reads the auth route (an auth-state
  // re-render, a loading flap). A re-run then finds the key already gone and
  // re-replaces to defaultRoute, CLOBBERING the in-flight saved-path navigation —
  // a deep link that routed through login then landed on defaultRoute instead of
  // the saved path. The latch resets whenever the pathname is off the auth-route set.
  const authRouteRedirected = useRef(false);

  // The last settled authentication state this guard observed (null before the first), and
  // the pathname a session ended on. The effect can re-run on that same pathname before the
  // login navigation commits, so the "do not save" decision is held for that pathname rather
  // than for one run.
  const lastAuthenticated = useRef<boolean | null>(null);
  const sessionEndedOn = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (lastAuthenticated.current === true && !isAuthenticated) {
      sessionEndedOn.current = pathname;
      clearRedirectPath(redirectKey);
    } else if (isAuthenticated || sessionEndedOn.current !== pathname) {
      sessionEndedOn.current = null;
    }
    lastAuthenticated.current = isAuthenticated;

    if (!authRedirectRoutes.includes(pathname)) {
      authRouteRedirected.current = false;
    }

    // Root path special handling
    if (rootRedirect && pathname === "/") {
      replace(isAuthenticated ? rootRedirect.authenticated : rootRedirect.unauthenticated);
      return;
    }

    const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
    const isAuthRedirect = authRedirectRoutes.includes(pathname);

    // Unauthenticated on protected route -> save a visitor's path, go to login
    if (!isAuthenticated && !isPublic) {
      if (sessionEndedOn.current === null) saveRedirectPath(redirectKey, pathname);
      replace(loginRoute);
      return;
    }

    // Authenticated user on auth-only route (login, register, etc.)
    if (isAuthenticated && isAuthRedirect) {
      if (authRouteRedirected.current) return;
      authRouteRedirected.current = true;
      let target = defaultRoute;
      const saved = readRedirectPath(redirectKey);
      if (saved && !authRedirectRoutes.includes(saved)) {
        target = saved;
      }
      clearRedirectPath(redirectKey);
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
