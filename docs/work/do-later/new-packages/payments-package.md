# A shared payments package built from ttt-prod's Stripe pipeline

**What:** Move ttt-prod's Stripe pipeline out of the app into a generic package, and grow it to cover subscriptions and, if ever needed, paying out to third parties.
**Severity:** low
**Came from:** DJ, 2026-10-31, in the Q-Sports multi-organization end-state conversation
**Trigger:** A second product needs to take money — Q-Sports charging an organization for league access, or upgraded player accounts — or ttt-prod adds a second checkout product (Bouquets).

## Why

No payment package exists today. All of it lives in ttt-prod (`functions/src/payments/`) and
`ttt-core`, built for one product: one-time Stripe Checkout pledges. What it already gets right is
exactly what a second product would otherwise rebuild:

- a webhook that verifies Stripe's signature and records each Stripe event once;
- a canonical money record that is never deleted, with the Stripe ids kept apart from
  anything a client can read;
- refunds, disputes, an append-only ledger, and a holding queue for paid events that cannot be
  recorded, feeding admin tasks;
- a category seam — each checkout carries its product category, so a second product dispatches
  to its own recorder instead of being mis-recorded as the first.

A second product taking money is the moment to move it, so the two never hold two copies
(RULE-STD-ENG-002).

## The idea, generically

The app supplies its products, categories, amounts, collections, wording, and who may buy what
(RULE-STD-ARCH-201); nothing here names an app's security internals (RULE-STD-ARCH-209).

- **One-time checkout** — what ttt-prod runs today, generalized over the category.
- **Subscriptions** — not built anywhere yet. Q-Sports' likely shape is an organization paying
  monthly for its leagues, and maybe a player paying for an upgraded account. Needs the subscription
  lifecycle (started, renewed, past due, canceled) as the source of an "is this paid up?" fact the
  app reads.
- **Payouts (Stripe Connect)** — only if a product ever collects money on someone else's behalf
  (league fees paid to a bowling alley through the app, or ttt-prod's Bouquet artisan splits). Noted
  as a future need in ttt-prod's pledge design; not needed for the first version.
- **Server-side webhook and recorder helpers** behind `./server`; a checkout button and status
  screens behind `./react` (RULE-STD-ARCH-202).

## Cost

Stripe has no monthly fee: about 2.9% + 30¢ per card charge, plus Stripe Billing's per-charge
percentage for subscriptions. Nothing is paid until money is taken.

## Done when

- The package is built, documented in `docs/packages/`, and green in `npm run test:quiet`.
- ttt-prod has moved its pledge pipeline onto it with no change in behavior, and the second
  consumer has adopted it.
