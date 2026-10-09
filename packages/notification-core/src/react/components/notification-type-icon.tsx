'use client';

import type { NotificationSystemConfig } from '../../types.js';

/**
 * A row's type icon: the type's own `icon` text, or a bell drawn in `currentColor`, so the
 * row's icon class colors and sizes it like any other glyph. Decorative — the row's title says
 * what it is.
 */
export function NotificationTypeIcon({ config, type }: { config: NotificationSystemConfig; type: string }) {
  const icon = config.types[type]?.icon;
  return (
    <div className="ntf-item-icon" aria-hidden="true">
      {icon ?? (
        <svg
          className="ntf-item-icon-glyph"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      )}
    </div>
  );
}
