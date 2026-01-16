export function canAccessThread(args: {
    isAdmin: boolean;
    currentUserId: string;
    allowedUserIds?: string[];
  }) {
    const { isAdmin, currentUserId, allowedUserIds } = args;
    if (isAdmin) return true;
    if (!allowedUserIds) return false;
    return allowedUserIds.includes(currentUserId);
  }
  