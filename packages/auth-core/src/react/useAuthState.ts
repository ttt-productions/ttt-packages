import { useEffect, useState } from "react";
import type { Auth, User } from "firebase/auth";
import { onAuthStateChanged } from "../auth";

export type AuthState = {
  user: User | null;
  loading: boolean;
  error: unknown | null;
};

export function useAuthState(auth: Auth): AuthState {
  // Initialize state based on current auth status to avoid initial flash
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState<boolean>(() => auth.currentUser === null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    // Only set loading if we don't have a user and haven't loaded yet
    // This prevents the "flash" when a user is already signed in (e.g. hydration)
    // or when simply refreshing the token.
    if (user === null && auth.currentUser === null) {
      setLoading(true);
    }

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return unsub;
  }, [auth]);

  return { user, loading, error };
}