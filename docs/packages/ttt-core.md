# @ttt-productions/ttt-core

TTT Productions-specific core package. Consolidates Firestore path constants, TypeScript types, and shared business constants between frontend and Cloud Functions backend. **This package is TTT Productions-specific and is NOT used by Q-Sports.**

## Version
0.2.11

## Dependencies
Runtime: `@ttt-productions/media-contracts` (for `PendingMediaPending`, used in `ContentViolation.pendingFile`).

## What It Contains

### Firestore Path Constants (`paths/`)
Single source of truth for every Firestore collection name used in TTT Productions.

- `COLLECTIONS` — Top-level collection names (userProfiles, allProjects, streetzFeed, contentLibrary, pendingMediaArchive, etc.)
- `USER_SUBCOLLECTIONS` — Subcollections under userProfiles/{userId}/ (profileSkills, privateData, userFollows, userLikes, etc.)
- `PROJECT_SUBCOLLECTIONS` — Subcollections under allProjects/{projectId}/ (publicData, projectPosts, chatChannels, etc.)
- `NESTED_SUBCOLLECTIONS` — Third-level+ subcollections (channelMessages, socialPosts, libraryItems, etc.)
- `SPECIAL_DOCS` — Singleton document IDs (adminList, futurePlans, rulesAndAgreements, summary)

### Path Builders (`paths/path-builders.ts`)
`PATH_BUILDERS` object with ~50 typed functions that return path segment tuples. Usage:
- Frontend (Web SDK): `doc(db, ...PATH_BUILDERS.userProfile(userId))`
- Backend (Admin SDK): `db.doc(toPath(PATH_BUILDERS.userProfile(userId)))`

Covers: user paths, project paths, streetz posts, library items, job listings, opportunities, universes, admin messages, project invites, content reports, admin tasks, feedback, skills, pending media archive, system data, donations, notifications.

### Collection Group Refs (`paths/collection-groups.ts`)
Constants for Firestore collection group queries.

### Collection Refs (`paths/collection-refs.ts`)
Helper functions that return typed collection references.

### Storage Path Helpers (`paths/storage-paths.ts`)
Canonical temporary upload path helpers used by `ttt-prod` and scheduled cleanup jobs:
- `TEMP_UPLOAD_PREFIX` — `'uploads/'`
- `buildTempUploadPath(fileOrigin, userId, fileId)` — returns `uploads/{fileOrigin}/{userId}/{fileId}`
- `isTempUploadPath(path)` — validates the canonical four-segment temporary upload shape
- `extractFileIdFromTempPath(path)` — extracts the pending-media/file id from a canonical temp path or returns `null`

`FileOrigin` is imported as a type from `@ttt-productions/media-contracts`; it does not live in ttt-core.

### TypeScript Types (`types/`)
Shared interfaces and types organized by domain. Cross-document identity references use uid-only shapes such as `{ uid: string }`; display names and profile-picture URLs resolve from `publicUsers` in ttt-prod:
- `user.ts` — Full user profile, private data, follows, mentions
- `project.ts` — Project, project posts, shares, invites, uid-only project ownership references
- `content.ts` — Tales, tunes, television, chapters, songs, shows
- `social.ts` — Streetz posts, likes, feed items
- `jobs.ts` — Job listings, applications, opportunities, uid-only creator/reply references
- `messaging.ts` — Admin messages, conversation messages, invite messages
- `moderation.ts` — `ContentViolation`, `Report`, `ReportGroup`; imports `PendingMediaPending` from `media-contracts`
- `admin.ts` — Admin task types, activity log

### Business Constants (`constants/`)
- `business.ts` — MAX_PROJECT_SHARES, MAX_STREETZ_DESCRIPTION_LENGTH, TASK_PRIORITY levels, SHORT_LINK config, FIRESTORE_BATCH_LIMIT
- `moderation.ts` — PERSPECTIVE_THRESHOLDS (toxicity scores), REJECTION_LIKELIHOODS (Cloud Vision), TEXT_MODERATION_MIN_LENGTH

### Audit step — storage path construction

From the ttt-packages repo root, run:

    grep -RIn "uploads/\${" packages --include='*.ts' --include='*.tsx'

Acceptable result: exactly one hit at `packages/ttt-core/src/paths/storage-paths.ts` (the helper's own implementation). Any other hit means a package is constructing temp upload paths inline instead of using `buildTempUploadPath` from `@ttt-productions/ttt-core`. Fix by importing the helper and replacing the template literal.

## Key Design Decisions
- Collection name constants are the canonical source of truth — changing them requires database migration.
- Path builders return tuples (not strings) so they work with both Web SDK's `doc(db, ...segments)` and Admin SDK's `db.doc(segments.join('/'))`.
- Types are kept generic enough for both frontend and backend consumption, while identity display data stays outside these document shapes and is resolved through the app identity source.

## Files
```
src/
  index.ts
  constants/
    index.ts
    business.ts
    moderation.ts
  paths/
    index.ts
    collections.ts          — COLLECTIONS, USER_SUBCOLLECTIONS, etc.
    path-builders.ts        — PATH_BUILDERS object
    storage-paths.ts        — TEMP_UPLOAD_PREFIX and temp upload path helpers
    collection-groups.ts
    collection-refs.ts
    utils.ts
  types/
    index.ts
    user.ts, project.ts, content.ts, social.ts, jobs.ts,
    messaging.ts, moderation.ts, admin.ts
```
