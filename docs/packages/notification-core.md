# @ttt-productions/notification-core

Generic active-to-history notification package.

## Owns

- Notification state/types
- Dedup/batch processing helpers
- React provider/hooks/components
- Server helpers where applicable

## Boundary

Internal notification implementation cleanup is tracked separately. This package should remain generic and should not import `ttt-core`.
