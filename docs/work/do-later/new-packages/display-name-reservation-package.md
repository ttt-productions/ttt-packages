# A shared package for display-name reservation

**What:** One generic mechanism for claiming a unique display name inside a transaction — the key rule, plan and apply halves, release on rename, retiring a name — so both products use one owner.
**Severity:** low
**Trigger:** DJ decides the name-reservation logic is shared between the products; at the latest, when ttt-prod consolidates its own copies (ttt-prod `docs/work/waiting-to-be-implemented/display-name-reservation-has-one-owner.md`).

## Why

Both products keep a unique-name reservation: one reservation document per name, keyed by a
normalised form, claimed in the same transaction as the profile write. ttt-prod does it inline in
three writers (registration, the self rename, the forced reset); Q-Sports has one owner
(`functions/src/users/displayNameReservation.ts`, `planDisplayNameReservation` /
`applyDisplayNameReservation`) shared by registration and its admin rename. The mechanism is the
same; only the names and the rules around them differ.

## What moves (to be confirmed when picked up)

- **Generic, into the package** (RULE-STD-ARCH-201): the reservation key function contract; a plan
  half (read the target's reservation and the subject's current one inside a transaction: claim,
  keep, or refuse as taken) and an apply half (write the claim, release the old name, optionally
  retire it), so any transaction can include it with reads before writes (RULE-STD-BACKEND-101);
  the retired-names check. Collection paths, the key normalisation and the document shape come from
  the app through a factory.
- **Stays in each app:** what a name is (ttt-prod usernames, Q-Sports real names), who may change it
  (ttt-prod: the member after a forced reset; Q-Sports: an admin), moderation and reserved-word lists
  (ttt-prod's username moderation), copy, audit events, and paths.

Nothing here names an app's security internals (RULE-STD-ARCH-209).

**Done when:** the package is published and every reservation read and write in both apps goes
through it.
