'use client';

import type { NotificationEmptyStateProps } from '../types.js';

/**
 * Empty state shown when there are no active notifications.
 */
export function NotificationEmptyState({
  text = "You're all caught up!",
}: NotificationEmptyStateProps) {
  return (
    <div className="ntf-empty">
      <svg
        className="ntf-empty-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <p className="ntf-empty-text">{text}</p>
    </div>
  );
}
