# @ttt-productions/firebase-helpers

Low-level Firestore utilities shared by all apps. Provides path builders, timestamp conversion, batch write helpers, pagination, and date formatting. Has both a client SDK entry point and an Admin SDK entry point.

## Version
0.2.19

## Dependencies
Peer: firebase, firebase-admin, date-fns.

## What It Contains

### Client Entry Point (`index.ts`)

**Path Utilities (`firestore/paths.ts`)**
Generic path builders (not app-specific — use ttt-core for TTT Productions paths):
- `joinPath(...parts)` — Join path segments, stripping leading/trailing slashes
- `colPath(...segments)` — Build a collection path
- `docPath(...segments)` — Build a document path
- `makeRootPaths(root)` — Create namespaced path helpers (e.g., `paths.col("users")` → `"ttt/users"`)

**Timestamps (`firestore/timestamps.ts` + `timestamps-universal.ts`)**
Client SDK timestamp utilities:
- `serverNow()` — Firestore server timestamp sentinel
- `dateToTs(date)` — Date → Firestore Timestamp
- `msToTs(ms)` — Epoch ms → Firestore Timestamp
- `tsToDate(ts)` — Firestore Timestamp → Date (null-safe)
- `toMillis(value)` — Universal converter: handles Firestore Timestamp, `{seconds, nanoseconds}`, Date, number, null → epoch ms or null

**Batch Operations (`firestore/batch.ts`)**
Client SDK batch write helpers:
- `commitInBatches<T>(db, items, { batchSize?, apply })` — Executes batch writes in chunks of 450 (safe under Firestore's 500-op limit). Returns `CommitInBatchesResult` with partial success info.
- `batchSet<T>(db, items, { batchSize? })` — Convenience wrapper for batch `set()` operations with optional merge.

**Pagination (`firestore/pagination.ts`)**
- `fetchPage<T>(baseQuery, { pageSize, cursor?, constraints? })` — Single-page fetch with cursor-based pagination
- `fetchOrderedPage<T>(baseQuery, { pageSize, orderByField, direction?, cursor?, constraints? })` — Ordered page fetch

**Date Formatting (`firestore/date-formatting.ts`)**
Date display helpers using date-fns.

**Types (`firestore/types.ts`)**
Shared Firestore type definitions.

**Utilities (`utils/chunk.ts`)**
- `chunk<T>(array, size)` — Split array into chunks of given size

### Admin Entry Point (`admin/index.ts`)
Server-side (Cloud Functions) equivalents:
- `commitInBatches` — Admin SDK version using `db.batch()` instead of `writeBatch(db)`
- `chunk` — Re-exported from utils
- Admin-specific timestamp helpers (`admin/timestamps.ts`)
- Shared types re-exported

## Key Design Decisions
- Client and Admin SDK batch helpers have identical APIs but use different Firestore imports. Import from the correct entry point.
- `toMillis()` is the universal timestamp normalizer — handles every format Firestore might return.
- `batchSize` defaults to 450 (not 500) to leave headroom for additional operations.
- Path utilities are intentionally generic — app-specific paths belong in ttt-core (TTT) or the app's own constants (Q-Sports).
- **Known gotcha:** `batch.set(merge:true)` with dotted field keys stores literal top-level keys in the emulator (not nested paths). Use `batch.update()` for existing docs and `batch.set()` with `FieldPath` instances for docs that may not exist.

## Files
```
src/
  index.ts                          — Client SDK entry point
  utils/chunk.ts
  firestore/
    types.ts, paths.ts
    timestamps.ts                   — Client SDK timestamps
    timestamps-universal.ts         — toMillis() and shared helpers
    batch.ts                        — Client SDK batch helpers
    pagination.ts
    date-formatting.ts
  admin/
    index.ts                        — Admin SDK entry point
    batch.ts                        — Admin SDK batch helpers
    timestamps.ts                   — Admin SDK timestamps
```
