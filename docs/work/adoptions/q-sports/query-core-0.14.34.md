# Adopt @ttt-productions/query-core 0.14.34

**What:** A non-hook helper reads a list of ids one document at a time and answers present or absent per id.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/query-core` 0.14.34.
- **Release:** `./scripts/release-multiple.sh ttt-core query-core chat-react media-viewer patch`.
- **What changed:** Additive. `loadFirestoreDocsById({ queryClient, db, collectionPath, ids, signal? })`
  (`./react`) is the non-hook form of the `'get'` transport, for a `queryFn` that pages a list of
  ids. It shares the doc loader's scope and `MAX_CONCURRENT_DOC_GETS` limit, answers one
  `DocByIdOutcome` per id in input order (`present` with the doc, or `absent` for a missing
  document or a `permission-denied` read), and rejects on any other failure. Nothing existing changes.
- **What the app must change:** Install. Then look for a `queryFn` that pages a stored list of ids
  with one `where(documentId(), 'in', …)` query on a collection whose rules gate reads on
  `resource.data` (a hidden flag, for example): one hidden or deleted id denies that whole query.
  Such a read moves to this helper and drops the absent ids. With no such read, the install is the
  whole adoption.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.34 or later, and no id-list
  query on a `resource.data`-gated collection remains.
