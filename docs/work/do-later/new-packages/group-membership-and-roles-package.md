# A shared package for groups, membership, and roles scoped to a group

**What:** A generic package for "a group with members, each holding roles that grant actions inside that group" — the mechanism both products have each built on their own.
**Severity:** low
**Came from:** DJ, 2026-10-31, in the Q-Sports multi-organization end-state conversation
**Trigger:** A product needs a third group-with-roles concept — the first one being Q-Sports' organization layer (a bowling alley, a game group, or a club that owns its own leagues and admins) — or a new product needs groups at all.

## Why

The same shape exists twice, built separately:

- **ttt-prod:** a Work's guild — guildmates hold standings, and one permission catalog in `ttt-core`
  (`packages/ttt-core/src/permissions/`: a standing catalog, an action catalog, and a
  standing-assignment policy) answers what each standing may do, read by the frontend and the
  backend alike. A Realm contains Works, so the nesting is already two levels deep.
- **Q-Sports:** `teamMemberships` — one record per person per team, with `captain` / `coCaptain` /
  `player`, resolved server-side for every team power. Leagues have no owners below the global
  admin roster yet.

A Q-Sports organization layer would be a third copy: an organization owning leagues, with its own
admins and referees beside the platform-wide ones. The third copy is the signal to build the
mechanism once (RULE-STD-ENG-002, RULE-STD-ENG-003).

## The idea, generically

Everything app-specific — the group kinds, the role names, the action catalog, the collections —
comes from the app through configuration and factories (RULE-STD-ARCH-201). Nothing here names an
app's security internals (RULE-STD-ARCH-209).

- **A group** — a typed container, optionally nested in a parent group (an organization → its
  leagues → their teams; a Realm → its Works).
- **A membership** — one record per person per group, with a status (only an active membership
  grants anything) and one or more roles.
- **A role catalog and an action catalog the app supplies**, and one pure check — "may this member
  do this action in this group?" — that the UI uses to offer an action and the server uses to
  enforce it. The stored membership is the authority, never a claim (roles in a group change too
  often for a token to carry them).
- **Inheritance down the nesting** — an organization's admin acting on a league the organization
  owns — decided by the app's catalog, never assumed by the package.
- **The doors** — invite, request to join, approve, remove, change role — as server helpers the
  app composes into its own transactions and audit events.
- **Feeding other packages** — the membership is what chat channel access, notifications, and
  payments ask "who is in this group?"; `chat-core` already takes access as one `allowed` fact
  from the app, so this package would be where that fact comes from.

## Open questions (DJ, when it is pulled in)

- Whether ttt-prod's guild and Q-Sports' team memberships move onto it, or only new group kinds
  use it at first. Both hold live or soon-live data, so moving either is a migration
  (RULE-STD-ENG-011).
- Whether ttt-prod's stake shares stay entirely app-side (they are business data, not membership).

## Done when

- The package is built, documented in `docs/packages/`, and green in `npm run test:quiet`.
- Its first consumer (likely Q-Sports' organization layer) has adopted it.
