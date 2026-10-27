# Adopt @ttt-productions/media-schemas 0.14.14

**What:** A `processing` pending-media row requires its claim fields, and the legacy-row lease fallbacks are gone.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/media-schemas` 0.14.14.
- **Release:** `./scripts/release-multiple.sh media-schemas ttt-core patch`.
- **What changed:**
  - The pending-media factory's `processing` variant requires `processingStartedAt`,
    `processingAttemptCount` (an integer of at least 1), and `processingLeaseExpiresAt`. Every claim
    (`decidePendingMediaClaim`'s write) sets all three; other statuses keep them optional.
  - `ClaimablePendingMedia` is a union keyed on `status`, and its `processing` member carries the
    three fields as required.
  - `effectivePendingMediaLeaseExpiry` is removed; a `processing` row's lease is its
    `processingLeaseExpiresAt`. A `processing` row with no lease no longer falls back to
    `processingStartedAt` or `createdAt`, and one with no attempt count is no longer read as attempt 1.
- **What the app must change:**
  - Replace any call to `effectivePendingMediaLeaseExpiry(row, policy)` with
    `row.processingLeaseExpiresAt`.
  - Remove any fallback for a `processing` row without these fields, and give every test fixture of
    a `processing` row all three.
  - If stored `processing` rows may lack the fields, they must be brought to the new shape before
    the install (they no longer parse).
- **Done when:** The lockfiles name `@ttt-productions/media-schemas` 0.14.14 or later, nothing in the
  app reads a `processing` row without its claim fields, and the gate is green.
