# @ttt-productions/ttt-core

TTT Productions-specific core package. Consolidates Firestore path constants, TypeScript types, and shared business constants between frontend and Cloud Functions backend. **This package is TTT Productions-specific and is NOT used by Q-Sports.**

## Version
0.2.0

## Dependencies
Runtime: `@ttt-productions/media-contracts` (for `PendingFile`, used in `ContentViolation`).

## What It Contains

### Firestore Path Constants (`paths/`)
Single source of truth for every Firestore collection name used in TTT Productions.

- `COLLECTIONS` — Top-level collection names (userProfiles, allProjects, streetzFeed, contentLibrary, etc.)
- `USER_SUBCOLLECTIONS` — Subcollections under userProfiles/{userId}/ (profileSkills, privateData, userFollows, userLikes, etc.)
- `PROJECT_SUBCOLLECTIONS` — Subcollections under allProjects/{projectId}/ (publicData, projectPosts, chatChannels, etc.)
- `NESTED_SUBCOLLECTIONS` — Third-level+ subcollections (channelMessages, socialPosts, libraryItems, etc.)
- `SPECIAL_DOCS` — Singleton document IDs (adminList, futurePlans, rulesAndAgreements, summary)

### Path Builders (`paths/path-builders.ts`)
`PATH_BUILDERS` object with ~50 typed functions that return path segment tuples. Usage:
- Frontend (Web SDK): `doc(db, ...PATH_BUILDERS.userProfile(userId))`
- Backend (Admin SDK): `db.doc(toPath(PATH_BUILDERS.userProfile(userId)))`

Covers: user paths, project paths, streetz posts, library items, job listings, opportunities, universes, admin messages, project invites, content reports, admin tasks, feedback, skills, system data, donations, notifications.

### Collection Group Refs (`paths/collection-groups.ts`)
Constants for Firestore collection group queries.

### Collection Refs (`paths/collection-refs.ts`)
Helper functions that return typed collection references.

### TypeScript Types (`types/`)
Shared interfaces and types organized by domain:
- `user.ts` — User profile, private data, follows, mentions
- `project.ts` — Project, project posts, shares, invites
- `content.ts` — Tales, tunes, television, chapters, songs, shows
- `social.ts` — Streetz posts, likes, feed items
- `jobs.ts` — Job listings, applications, opportunities
- `messaging.ts` — Admin messages, conversation messages, invite messages
- `moderation.ts` — `ContentViolation`, `Report`, `ReportGroup` (note: `FileOrigin` and `PendingFile` moved to `media-contracts` in Phase 1 Step 14a)
- `admin.ts` — Admin task types, activity log

### Business Constants (`constants/`)
- `business.ts` — MAX_PROJECT_SHARES, MAX_STREETZ_DESCRIPTION_LENGTH, TASK_PRIORITY levels, SHORT_LINK config, FIRESTORE_BATCH_LIMIT
- `moderation.ts` — PERSPECTIVE_THRESHOLDS (toxicity scores), REJECTION_LIKELIHOODS (Cloud Vision), TEXT_MODERATION_MIN_LENGTH

## Key Design Decisions
- Collection name constants are the canonical source of truth — changing them requires database migration.
- Path builders return tuples (not strings) so they work with both Web SDK's `doc(db, ...segments)` and Admin SDK's `db.doc(segments.join('/'))`.
- Types are kept generic enough for both frontend and backend consumption.

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
    collection-groups.ts
    collection-refs.ts
    utils.ts
  types/
    index.ts
    user.ts, project.ts, content.ts, social.ts, jobs.ts,
    messaging.ts, moderation.ts, admin.ts
```
