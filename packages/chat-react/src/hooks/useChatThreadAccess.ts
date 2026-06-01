import type { ChatAccessMode } from "@ttt-productions/chat-core";

export function canAccessThread(args: {
  accessMode: ChatAccessMode;
  isAdmin: boolean;
  currentUserId: string;
  allowedUserIds?: string[];
}): boolean {
  const { accessMode, isAdmin, currentUserId, allowedUserIds } = args;

  // Admin always bypasses access checks (admin moderation surfaces).
  if (isAdmin) return true;

  // Unauthenticated users never have access regardless of mode.
  if (!currentUserId) return false;

  if (accessMode === "firestore-rules") {
    // Defer to Firestore rules. If rules deny, onSnapshot will surface
    // permission-denied, but chat-core does not pre-deny.
    return true;
  }

  // accessMode === "explicit-allowlist"
  if (!allowedUserIds) return false;
  return allowedUserIds.includes(currentUserId);
}
