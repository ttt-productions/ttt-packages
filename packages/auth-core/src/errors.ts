export type AuthErrorCode =
  | "AUTH_UNKNOWN"
  | "AUTH_NETWORK_ERROR"
  | "AUTH_TOO_MANY_REQUESTS"
  | "AUTH_POPUP_CLOSED"
  | "AUTH_POPUP_BLOCKED"
  | "AUTH_CANCELLED"
  | "AUTH_USER_DISABLED"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_WRONG_PASSWORD"
  | "AUTH_INVALID_EMAIL"
  | "AUTH_EMAIL_ALREADY_IN_USE"
  | "AUTH_WEAK_PASSWORD"
  | "AUTH_REQUIRES_RECENT_LOGIN"
  | "AUTH_INVALID_CREDENTIAL"
  | "AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL"
  | "AUTH_PROVIDER_ALREADY_LINKED"
  | "AUTH_CREDENTIAL_ALREADY_IN_USE";

export type NormalizedAuthError = {
  code: AuthErrorCode;
  message: string;
  firebaseCode?: string;
  details?: Record<string, unknown>;
};

function pickFirebaseCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const anyErr = err as any;
  const c = anyErr.code;
  return typeof c === "string" ? c : undefined;
}

const MAP: Record<string, { code: AuthErrorCode; message: string }> = {
  "auth/network-request-failed": {
    code: "AUTH_NETWORK_ERROR",
    message: "Network error. Please check your connection and try again."
  },
  "auth/too-many-requests": {
    code: "AUTH_TOO_MANY_REQUESTS",
    message: "Too many attempts. Please wait a moment and try again."
  },
  "auth/popup-closed-by-user": {
    code: "AUTH_POPUP_CLOSED",
    message: "Sign-in popup was closed."
  },
  "auth/popup-blocked": {
    code: "AUTH_POPUP_BLOCKED",
    message: "Sign-in popup was blocked by the browser."
  },
  "auth/cancelled-popup-request": {
    code: "AUTH_CANCELLED",
    message: "Sign-in was cancelled."
  },
  "auth/user-disabled": {
    code: "AUTH_USER_DISABLED",
    message: "This account has been disabled."
  },
  "auth/user-not-found": {
    code: "AUTH_USER_NOT_FOUND",
    message: "No account found with that email."
  },
  "auth/wrong-password": {
    code: "AUTH_WRONG_PASSWORD",
    message: "Incorrect password."
  },
  "auth/invalid-email": {
    code: "AUTH_INVALID_EMAIL",
    message: "Invalid email address."
  },
  "auth/email-already-in-use": {
    code: "AUTH_EMAIL_ALREADY_IN_USE",
    message: "That email is already in use."
  },
  "auth/weak-password": {
    code: "AUTH_WEAK_PASSWORD",
    message: "Password is too weak."
  },
  "auth/requires-recent-login": {
    code: "AUTH_REQUIRES_RECENT_LOGIN",
    message: "Please re-authenticate and try again."
  },
  "auth/invalid-credential": {
    code: "AUTH_INVALID_CREDENTIAL",
    message: "Invalid credentials. Please try again."
  },
  "auth/account-exists-with-different-credential": {
    code: "AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL",
    message: "An account already exists with a different sign-in method."
  },
  "auth/provider-already-linked": {
    code: "AUTH_PROVIDER_ALREADY_LINKED",
    message: "That provider is already linked to this account."
  },
  "auth/credential-already-in-use": {
    code: "AUTH_CREDENTIAL_ALREADY_IN_USE",
    message: "Those credentials are already associated with another account."
  }
};

export function normalizeAuthError(err: unknown, details?: Record<string, unknown>): NormalizedAuthError {
  const firebaseCode = pickFirebaseCode(err);

  const mapped = firebaseCode ? MAP[firebaseCode] : undefined;
  if (mapped) {
    return {
      code: mapped.code,
      message: mapped.message,
      firebaseCode,
      details
    };
  }

  // best-effort message (don’t leak weird objects)
  const msg =
    typeof (err as any)?.message === "string"
      ? (err as any).message
      : "Authentication error. Please try again.";

  return {
    code: "AUTH_UNKNOWN",
    message: msg,
    firebaseCode,
    details
  };
}

/** Convenience: returns just the user-facing message string */
export function getErrorMessage(error: unknown): string {
  return normalizeAuthError(error).message;
}
