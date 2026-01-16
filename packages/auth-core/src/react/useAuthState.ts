import { useEffect, useState } from "react";
import type { Auth, User } from "firebase/auth";
import { onAuthStateChanged } from "../auth";

export type AuthState = {
  user: User | null;
  loading: boolean;
  error: unknown | null;
};

export function useAuthState(auth: Auth): AuthState {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    setLoading(true);
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
