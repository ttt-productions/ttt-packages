# @ttt-productions/short-link-core

Generic short links: a short id that stands for one in-app destination, counted on every visit.

## Owns

- **The id.** `generateShortLinkId()` draws `SHORT_LINK_ID_LENGTH` characters from
  `SHORT_LINK_ID_ALPHABET` (no look-alike characters) from the platform's secure random source,
  redrawing any byte past the alphabet's last whole cycle so no character is favoured.
  `shortLinkIdSchema` accepts exactly that shape. `SHORT_LINK_ID_MAX_ATTEMPTS` bounds the collision
  loop.
- **The link document.** `createShortLinkSchema({ type, metadata })` is the stored shape — short id,
  destination, the app's target type and metadata, creator, created time, click count — with the
  app's own target schemas plugged in. `ShortLinkDocument<Type, Metadata>` is its type. A link stores
  no full URL: the app builds the address where it shows it, from its one public-site URL and its
  short-link route, so no domain lives in stored data.
- **The create core.** `runShortLinkCreate(transaction, request)` answers the destination's
  existing link (found by its destination) or creates one at an unused id, with no clicks. It makes
  the transaction's last reads and then its one write, so the caller reads before it and writes after
  it. Out of ids, it throws `ShortLinkIdExhaustedError` and writes nothing.
- **The lookup core.** `runShortLinkLookup(transaction, linkRef)` counts the click and answers the
  destination, or `null` for a link that does not exist. It answers any caller, signed in or not;
  whether a visitor must sign in before seeing the page is the app's own page rule. A stored link
  with no destination or click count throws `ShortLinkMalformedError`.
- **The redirect page.** `ShortLinkRedirector({ visit, navigate, pending, missing, failed })`
  replaces the page with an in-app destination (`isInAppDestination`: one leading slash, never a
  protocol-relative URL), and otherwise renders the app's pending, missing, or failed content.

## Entry points

- `.` — pure: the id, its constants, the schemas, and `isInAppDestination`.
- `./server` — the create and lookup cores, over `firebase-helpers/server`'s Firestore contract.
- `./react` — `ShortLinkRedirector` (React is an optional peer).

## Boundary

The app supplies its target union and labels, its collection, the address it shows (its one
public-site URL plus its short-link route), its callables and their authorization, its rules, any rate limit, and every word
shown. The package names no app, collection, or route (RULE-STD-ARCH-201).
