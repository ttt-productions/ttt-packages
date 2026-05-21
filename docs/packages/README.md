# Package docs

This folder documents current ownership for each `@ttt-productions/*` package after the package architecture rework.

## Current package set

### Generic foundations

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

### Generic feature packages

- `file-input`
- `media-viewer`
- `media-processing-core`
- `notification-core`
- `report-core`
- `upload-core`
- `upload-ui`
- `chat-core`

### Application data

- `ttt-core`

## Renames from the rework

- `media-contracts` became `media-schemas`.
- `upload-form` became `upload-ui`.
- Pure chat schemas were split into `chat-schemas` so `ttt-core` and backend code can compose chat validation without importing the React-heavy chat UI package.

Delete the old `media-contracts.md` and `upload-form.md` docs after this patch is applied.
