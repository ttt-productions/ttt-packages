# Adopt @ttt-productions/query-core 0.14.37

**What:** Every live `useFirestoreDoc` and `useFirestoreCollection` read is shared per query key: one listener and one source state for every mount of the key, so a second mount is live at once.
**Severity:** medium

**Outdated design.** This release leaves the handling of a copy kept on the device unchanged. The agreed design changes it: a live read shows loading until the server has answered, and a device copy is never handed to the page as the answer. A later query-core release changes it. Take the install from this file.

- **Package and version:** `@ttt-productions/query-core` 0.14.37.
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`.
- **What changed:** the APIs of `useFirestoreDoc` and `useFirestoreCollection` are unchanged. With
  `subscribe: true`:
  - Every mount of one query key in one `QueryClient` shares ONE `onSnapshot` listener and ONE
    status (source state, listener error, pending restart). The key is the client's own hash of the
    query key (its `queryKeyHashFn`), so keys that differ only in object key order share one
    listener. The listener opens with the first mount, stays while any mount remains, and stops a
    microtask after the last one leaves, so a mount of the same key arriving in the same commit
    (a route change, StrictMode) takes it over.
  - A mount of a key that is already live renders its data and `sourceState: 'live'` in its first
    render, with no `connecting` pass and no second listener.
  - A failure reaches every mount; `refetch()` from any mount restarts the one listener once and
    settles every mount; the `permission-denied` ladder runs once per key.
  - When the key's cache entry is removed, cleared, or reset while its listener is live (a
    sign-out's cache clear included), the listener re-opens and refills the entry for every mount,
    reading `connecting` until it answers.
  - Mounts of one key are expected to pass the same path, constraints, and `select`. When one
    mount changes them, the key's listener follows it (latest wins), and snapshots are mapped with
    the most recently mounted instance's `select`.
  - When only a collection's constraints change under one key and the listener had answered
    (`live`, or `offline` after being live), the rows
    stay on screen as placeholder data (`isPlaceholderData`, `isFetching`, `isRefetching` true)
    until the new constraints answer from the server; `sourceState` reads `connecting` meanwhile.
    A changed path or db, or a failed read, carries nothing.
  - A remount after the last mount left starts a fresh listener and reads `connecting` until the
    server answers, as before. Missing documents, `fromCache` handling, and a failure keeping the
    last answered data are unchanged.
- **What the app must change:** the install. Then check:
  - any two live reads in ttt-prod that use the same query key with a different path, constraints,
    or `select` at the same time: they now share one listener (the latest wins), so give each read
    its own key;
  - any code or test that counted one listener per mount, expected a second mount of a live key to
    start `connecting`, or expected the listener to stop in the same tick as the last unmount;
  - any collection read that keeps one key while its constraints change, which now reports
    `isPlaceholderData` and fetching during the switch.
- **Done when:** the lockfiles name `@ttt-productions/query-core` 0.14.37 or later, the checks above
  find nothing (or are fixed), and the typechecks and ttt-prod's Normal Test Flow are green.
