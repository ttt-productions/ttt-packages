# Upload Path Invariant: canonical Storage path shape

Every file uploaded anywhere in the TTT Productions ecosystem MUST follow the canonical Firebase Storage path shape. This is a defense-in-depth invariant enforced at four layers: client component, upload library, Firestore rules, and Storage rules.

## Rule

The canonical path shape is:

    uploads/{fileOrigin}/{uid}/{pendingMediaDocId}

Constraints:

- **No file extension on the storage path.** The file's contentType drives the extension at download time.
- `fileOrigin` is always kebab-case and MUST be a value in the `FileOrigin` union exported from `@ttt-productions/media-contracts`.
- `pendingMediaDocId` is the Firestore document ID (uuid) of the corresponding `pendingMedia` document.
- `contentType` MUST be a valid `image/*`, `video/*`, or `audio/*`. `application/octet-stream` is rejected at the rules layer.
- Firestore rule on `pendingMedia` enforces strict equality between the `pendingMedia` doc's stored path and the canonical builder output. Regex matching was replaced with `==` to remove ambiguity.

## Why

- **Orphan cleanup correctness.** The scheduled orphan-cleanup job lists `uploads/{fileOrigin}/` prefixes and cross-references against `pendingMedia` documents. Any deviation from the canonical shape means a file either never gets cleaned up (unbounded storage cost) or gets cleaned up while still in use (data loss).
- **Single client API surface.** `buildTempUploadPath(fileOrigin, uid, fileId)` from `@ttt-productions/ttt-core` is the only allowed builder. Hardcoded `uploads/...` template strings in app code drift the moment the constant changes.
- **Firestore + Storage rules can validate without parsing.** With strict equality on the path, the rules don't have to parse out segments and validate each one — they just compare to the builder output reproduced in the rules language.
- **Cross-app consistency.** Q-Sports uploads also follow this shape (with a Q-Sports-specific `FileOrigin` set). The same `upload-core` and `file-input` packages serve both apps because the path shape is defined in shared `media-contracts`.

## Where it applies

- Every Firebase Storage write originating from app code or `@ttt-productions/*` packages.
- Every `pendingMedia` Firestore document (`storagePath` field).
- Every reference to upload paths in `firestore.rules` and `storage.rules` in both ttt-prod and Q-Sports.
- Cloud Function processors that read from temp upload paths (media processing pipeline, etc.).

## Defense-in-depth layers

The invariant is enforced at four layers, each independently:

1. **`@ttt-productions/file-input`** ensures every File it emits has a valid contentType via `ensureFileWithContentType`. The function checks `file.type`, falls back to extension lookup, then to a kind-default.
2. **`@ttt-productions/upload-core`** throws `UploadError('missing_content_type')` or `UploadError('invalid_content_type')` before any bytes hit Storage.
3. **Firestore rules** enforce strict path equality on the `pendingMedia` document and validate the `fileOrigin` against the allowlist.
4. **Storage rules** enforce the contentType regex (`image/*`, `video/*`, `audio/*`) at the bucket level.

## What it forbids

- Hardcoded `uploads/...` template strings in any package or app code. Use `buildTempUploadPath` from `@ttt-productions/ttt-core`.
- Adding a new `FileOrigin` value to `@ttt-productions/media-contracts` without updating Firestore rules in lockstep. The rule's allowlist must agree with the type union.
- Storing files at any path NOT under the canonical prefix. There is no escape hatch for "just this one upload type."
- Filenames with extensions on the Storage path. Extensions are derived from contentType at download.
- `application/octet-stream` contentType. The rules reject it; the upload library throws before reaching the rules.
- Partial migrations. A schema change to the path shape touches `firestore.rules`, `storage.rules`, the `FileOrigin` union, every upload mutation, every cleanup job, and every download path in lockstep.

## What it allows

- **App-specific `FileOrigin` values.** ttt-prod and Q-Sports each define their own enum members in `media-contracts`. The shape rule is shared; the allowed origins differ per app.
- **Long-term storage paths separate from `uploads/`.** Once a file is processed and committed (e.g. moved to `library/{itemId}/{fileId}`), it leaves the `uploads/` namespace. The invariant only governs the temp/pending phase.
- **Multiple files per `pendingMedia` doc** if the doc shape supports it. The path uses the doc ID, not a per-file ID, so multi-file uploads need to encode their own per-file structure within the doc.

## When to revisit

- If we adopt a different storage backend (S3, R2, etc.). The invariant is Firebase-Storage-specific by virtue of the Firestore + Storage rules layer.
- If the orphan cleanup job moves to a different strategy (e.g. event-driven via a Storage trigger instead of scheduled scan). At that point, the path-equality requirement may relax.
- If we hit a hard limitation in Firestore path expressions that requires changing the canonical shape. Don't change the shape pre-emptively — change it when forced.

## Checking compliance

The hygiene playbook in ttt-prod (`docs/playbooks/CODEBASE_HYGIENE_PLAYBOOK.md`, step 4a) greps for hardcoded `uploads/${...}` template strings. Run the same grep against `packages/` when auditing ttt-packages — every hit is a violation that must either migrate to `buildTempUploadPath` or be documented as an intentional exception with a comment explaining why.
