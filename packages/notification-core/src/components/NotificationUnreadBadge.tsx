'use client';

import { useUnreadCount } from '../hooks/useUnreadCount.js';
import type { NotificationUnreadBadgeProps } from '../types.js';

/**
 * Unread count badge (red circle with number).
 * Renders nothing when count is 0.
 * Apps wrap this around whatever trigger element they want.
 */
export function NotificationUnreadBadge({
  config,
  userId,
  category,
  refetchInterval,
}: NotificationUnreadBadgeProps) {
  const { count, hasMore } = useUnreadCount({
    config,
    userId,
    category,
    refetchInterval,
  });

  if (count === 0) return null;

  const displayCount = hasMore ? '99+' : count > 9 ? '9+' : String(count);

  return (
    <span className="ntf-badge">{displayCount}</span>
  );
}
