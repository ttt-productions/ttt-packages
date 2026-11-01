# A shared package for short links, with a QR code component in ui-core

**What:** One generic short-link mechanism (id, link document, create and visit cores, the redirect route) both products use, plus a themed QR code component in `ui-core`, so neither app builds its own.
**Severity:** medium
**Came from:** the Q-Sports 2.0 migration orchestrator, 2026-11-01, on DJ's instruction to write up what moving the shared parts into packages would need; from the Q-Sports QR invite design (`q-sports-league/docs/work/do-later/qr-code-team-invite.md`, which DJ has since pulled into 2.0).
**Trigger:** the Q-Sports QR and short-link ghost-player invite is built (part of Q-Sports 2.0, before its Normal Test Flow).

## Why

ttt-prod has short links today; Q-Sports' invite needs the same thing. Built twice, they drift
(RULE-STD-ENG-002, RULE-STD-ENG-003); the workspace rule is that a mechanism both apps need lives here.

ttt-prod's version: a `shortLinks` document per link (short id and URL, destination, target type,
the target's ids in `metadata`, creator, click count), made by `createShortLink` over a target union
(`CreateShortLinkInputSchema` in ttt-core), which returns the existing link when a target already has
one; `/v/{shortId}` resolves a link through `trackShortLinkClick`, which counts the click and answers
the destination; an admin page lists them; links are never deleted. ttt-prod's
`functions/src/utility/createShortLink.ts` holds its logic inside the callable, against
RULE-STD-ARCH-002 (ttt-prod `docs/work/waiting-to-be-implemented/entry-points-are-thin-adapters.md`),
so the package is written over cores, not by lifting that file.

## What moves (to be confirmed against both apps when picked up)

- **Generic, into the package** (RULE-STD-ARCH-201: no app identifier, path, copy or policy):
  - the short-id generation and its collision loop;
  - the link document's generic shape (id, URL, destination, target kind, target ids, creator,
    click count, created time), with the app's target union plugged in;
  - the create core (returns the existing link for a target that has one) and the visit core
    (counts the click, answers the destination), as server helpers taking the app's collection,
    target resolver and URL builder through a factory;
  - the redirect route's resolver, and whether a signed-out visitor goes to sign-in first or opens
    the link signed out, as an app option (ttt-prod requires sign-in; Q-Sports' invite opens signed
    out).
- **Stays in each app:** its target union and labels (`ttt-core`, `q-core`), its collection path,
  its own callable and its rules, its rate limits (ttt-prod has them; Q-Sports runs no request rate
  limiter), its admin page.
- **The QR code component, into `ui-core`:** ttt-prod draws its authenticator-setup QR with the
  small `uqr` encoder as an inline SVG (`EnrollmentQrCode` in
  `src/components/admin/operator-step-up-dialog.tsx`, themed by its `.ttt-qr-code` classes). A
  generic `QrCode` component (value, size, an accessible label) with theme-token colors moves into
  `ui-core`, and both apps import it; ttt-prod's step-up dialog adopts it.

## Order

Packages first: the package and the `ui-core` component, their own tests, adoption files for both
apps, one release; then Q-Sports builds its invite on them and ttt-prod adopts (its short links and
its step-up QR move onto the package).

**Done when:** the package and the `ui-core` QR component are published, both apps' short links and
QR codes use them, and no copy of the mechanism is left in either app.
