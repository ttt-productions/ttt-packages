"use client";

import {
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuthState } from "./useAuthState";
import { getIdTokenClaims } from "../claims";
import type {
  AuthProviderConfig,
  AuthContextValue,
  BaseProfile,
  ProfileError,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuthContext = createContext<AuthContextValue<any, any> | null>(null);

interface AuthProviderProps<
  TProfile extends BaseProfile,
  TClaims,
> {
  config: AuthProviderConfig<TProfile, TClaims>;
  children: ReactNode;
}

export function AuthProvider<
  TProfile extends BaseProfile = BaseProfile,
  TClaims = Record<string, unknown>,
>({ config, children }: AuthProviderProps<TProfile, TClaims>) {
  const { user, loading: authLoading } = useAuthState(config.auth);

  const [claims, setClaims] = useState<TClaims>(config.defaultClaims);
  const [claimsLoading, setClaimsLoading] = useState(true);

  const [userProfile, setUserProfile] = useState<TProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<ProfileError | null>(null);

  // Refs for cleanup
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUidRef = useRef<string | null>(null);

  // Stable config ref so effects don't re-fire on config object identity changes
  const configRef = useRef(config);
  configRef.current = config;

  // --- Claims fetching ---
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setClaims(configRef.current.defaultClaims);
      setClaimsLoading(false);
      return;
    }

    let cancelled = false;
    setClaimsLoading(true);

    getIdTokenClaims(user)
      .then((raw) => {
        if (cancelled) return;
        setClaims(configRef.current.parseClaims((raw ?? {}) as Record<string, unknown>));
      })
      .catch((err) => {
        if (cancelled) return;
        configRef.current.onError?.(err, "getIdTokenClaims");
        setClaims(configRef.current.defaultClaims);
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  // --- Profile listener ---
  useEffect(() => {
    if (authLoading) return;

    const uid = user?.uid ?? null;
    const prevUid = prevUidRef.current;
    prevUidRef.current = uid;

    // Clean up previous listener + timeout if user changed
    if (uid !== prevUid) {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    // User signed out
    if (!uid) {
      setUserProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      configRef.current.onAuthStateChange?.(null);
      configRef.current.onProfileChange?.(null, null);
      return;
    }

    // User signed in (or changed)
    setProfileLoading(true);
    setProfileError(null);
    configRef.current.onAuthStateChange?.(user);

    const timeout = (configRef.current.profileTimeout ?? 15) * 1000;
    const [colPath, docId] = configRef.current.profilePath(uid);
    const docRef = doc(configRef.current.db, colPath, docId);

    // Start timeout timer
    timeoutRef.current = setTimeout(() => {
      // Only fire if we're still waiting (profileLoading is still true)
      setProfileError({
        code: "PROFILE_TIMEOUT",
        message: `Profile document not found after ${configRef.current.profileTimeout ?? 15}s.`,
        uid,
      });
      setProfileLoading(false);
    }, timeout);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        // Clear timeout on any successful snapshot
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const parsed = configRef.current.parseProfile
            ? configRef.current.parseProfile(data, uid)
            : ({ uid, ...data } as unknown as TProfile);

          setUserProfile(parsed);
          setProfileError(null);
          setProfileLoading(false);
          configRef.current.onProfileChange?.(parsed, user);
        } else {
          // Doc doesn't exist yet — restart timeout if not already timed out
          if (!timeoutRef.current) {
            timeoutRef.current = setTimeout(() => {
              setProfileError({
                code: "PROFILE_NOT_FOUND",
                message: "Profile document does not exist.",
                uid,
              });
              setProfileLoading(false);
            }, timeout);
          }
        }
      },
      (err) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        configRef.current.onError?.(err, "profile onSnapshot");
        setProfileError({
          code: "PROFILE_LISTENER_ERROR",
          message: err instanceof Error ? err.message : "Profile listener failed.",
          uid,
        });
        setProfileLoading(false);
      },
    );

    profileUnsubRef.current = unsub;

    return () => {
      unsub();
      profileUnsubRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, authLoading]);

  // --- refreshClaims ---
  const refreshClaims = useCallback(async () => {
    if (!user) return;
    try {
      const result = await user.getIdTokenResult(true);
      setClaims(
        configRef.current.parseClaims((result.claims ?? {}) as Record<string, unknown>),
      );
    } catch (err) {
      configRef.current.onError?.(err, "refreshClaims");
    }
  }, [user]);

  // --- Context value ---
  const loading = authLoading || claimsLoading || profileLoading;

  const value = useMemo<AuthContextValue<TProfile, TClaims>>(
    () => ({
      user,
      userProfile,
      claims,
      loading,
      authLoading,
      claimsLoading,
      profileLoading,
      profileError,
      isAuthenticated: !!user,
      refreshClaims,
    }),
    [
      user,
      userProfile,
      claims,
      loading,
      authLoading,
      claimsLoading,
      profileLoading,
      profileError,
      refreshClaims,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
