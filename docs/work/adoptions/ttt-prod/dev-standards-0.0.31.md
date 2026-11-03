# Adopt @ttt-productions/dev-standards 0.0.31

**What:** RULE-STD-BACKEND-112 no longer says Firestore caps a batch at 500 writes.
**Severity:** low
**Came from:** the Q-Sports data-rules ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.31.
- **Release:** `./scripts/release-multiple.sh notification-core firebase-helpers q-core dev-standards patch`.
- **What changed:** RULE-STD-BACKEND-112's "one batch or transaction over a set with no bound" line
  in `rules/backend/firestore-storage-and-transactions.md` names Firestore's real limits: 10 MiB per
  commit, 270 seconds per transaction, 500 field transforms on one document — not a write count.
- **What the app must change:** the install. The code built on the old limit is ttt-prod's item
  `docs/work/waiting-to-be-implemented/firestore-500-write-limit-removed.md`, whose "Q-Sports fixes
  that line" note this release settles.
- **Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.31 or later.
