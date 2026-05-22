# Package docs

This folder documents current ownership for each `@ttt-productions/*` package after the package architecture rework.

The current monorepo contains **21 packages**:

## Generic foundations

- `auth-core`
- `firebase-helpers`
- `chat-schemas`
- `media-schemas`
- `mobile-core`
- `monitoring-core`
- `query-core`
- `theme-core`
- `ui-core`
- `rate-limit-core`
- `audit-core`
- `moderation-core`

## Generic feature packages

- `file-input`
- `media-viewer`
- `media-processing-core`
- `notification-core`
- `report-core`
- `upload-core`
- `upload-ui`
- `chat-core`

## Application data

- `ttt-core`

## Rework notes

- `media-schemas` is the renamed generic-media successor to the old `media-contracts` package.
- `upload-ui` is the renamed guarded-upload successor to the old `upload-form` package.
- `chat-schemas` is intentionally separate from `chat-core` so backend code and `ttt-core` can compose chat schemas without importing the React-heavy chat runtime.

Old package docs for `media-contracts` and `upload-form` should not exist in this folder. If they reappear, delete them rather than updating them.
