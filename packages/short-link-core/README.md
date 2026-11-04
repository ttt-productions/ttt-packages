# @ttt-productions/short-link-core

Generic short links: the link document and its id, the create and lookup cores, and the redirect
page.

- `.` — pure: the id generator and its constants, `shortLinkIdSchema`, `createShortLinkSchema`, and
  `isInAppDestination`.
- `./server` — `runShortLinkCreate` and `runShortLinkLookup`, run inside the app's transaction.
- `./react` — `ShortLinkRedirector`.

The app supplies its target types and metadata, its collection, the address it shows (its site
URL plus its short-link route), its callables, its rules, and every word shown.
