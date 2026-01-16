import type { Auth, User } from "firebase/auth";
import { onAuthStateChanged as fbOnAuthStateChanged } from "firebase/auth";

export type Unsubscribe = () => void;

export function getAuthUser(auth: Auth): User | null {
  return auth.currentUser;
}

/**
 * Thin wrapper around Firebase onAuthStateChanged.
 * - always returns the unsubscribe function
 * - preserves Firebase callback signature
 */
export function onAuthStateChanged(
  auth: Auth,
  cb: (user: User | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return fbOnAuthStateChanged(auth, cb, onError);
}
