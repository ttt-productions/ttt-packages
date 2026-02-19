"use client";

import { useEffect } from "react";

export interface AuthGuardConfig {
  /** Routes accessible without authentication */
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
  /** From useAuth() — user has a profile doc */
  hasProfile: boolean;
}

const DEFAULT_REDIRECT_KEY = "auth_redirect_path";

/**
 * Handles route protection. Call in app shell component.
 *
 * - Does nothing while loading.
 * - Redirects unauthenticated users from protected routes to loginRoute.
 * - Redirects authenticated users from authRedirectRoutes to defaultRoute.
 * - Saves attempted path for post-login redirect.
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
    hasProfile,
  } = config;

  useEffect(() => {
    if (loading) return;

    // Root path special handling
    if (rootRedirect && pathname === "/") {
      replace(isAuthenticated ? rootRedirect.authenticated : rootRedirect.unauthenticated);
      return;
    }

    const isPublic =
      publicRoutes.some((r) => pathname.startsWith(r)) || pathname.startsWith("/v/");
    const isAuthRedirect = authRedirectRoutes.includes(pathname);

    // Unauthenticated on protected route -> save path, go to login
    if (!isAuthenticated && !isPublic) {
      if (typeof window !== "undefined") {
        localStorage.setItem(redirectKey, pathname);
      }
      replace(loginRoute);
      return;
    }

    // Authenticated user on auth-only route (login, register, etc.)
    if (isAuthenticated && isAuthRedirect) {
      // Still registering -- profile not created yet, stay on page
      if (!hasProfile && typeof window !== "undefined" && localStorage.getItem("isRegistering") === "true") {
        return;
      }

      // Redirect to saved path or default
      let target = defaultRoute;
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(redirectKey);
        if (saved && !authRedirectRoutes.includes(saved)) {
          target = saved;
        }
        localStorage.removeItem(redirectKey);
      }
      replace(target);
    }
  }, [
    loading,
    isAuthenticated,
    hasProfile,
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
