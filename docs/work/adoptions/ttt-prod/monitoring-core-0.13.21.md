# Adopt @ttt-productions/monitoring-core 0.13.21

**What:** the browser init no longer sends Firestore's multi-tab "update time in the future" console line to Sentry when the two tab clocks read 1 ms apart.
**Severity:** low

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.21.
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`.
- **What changed:** `initBrowserMonitoring`'s `beforeSend` drops the console-captured line
  `@firebase/firestore: Firestore (<ver>): Detected an update time that is in the future: A > B`
  when it ends the message and `A - B` is at most 1 ms. A wider gap, any other Firestore line, and
  the same text with anything after it are still sent. The text check is the new root export
  `isFirestoreTabClockRoundingLine(text)`, which is additive; no existing option or export changed.
- **What the app must change:** the install.
- **Done when:** The lockfile names `@ttt-productions/monitoring-core` 0.13.21 or later.
