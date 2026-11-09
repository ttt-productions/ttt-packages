# A guard against hand-written bounded transaction reads

**What:** A repo-guards check that fails a transaction read written as "read up to N+1, throw if over N" by hand instead of through the app's one bounded-read owner.
**Severity:** low
**Came from:** the triage-fixes session (Q-Sports scope), which moved twelve hand-written copies onto Q-Sports' owner, `readBoundedInTransaction` (`functions/src/shared/bounded-read.ts`)
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

A transaction's bounded read has one owner per app: it reads `limit(bound + 1)` through the
transaction and throws a plain error naming what holds more than its bound. The hand-written form
compiles and passes every test, so a new copy comes back unnoticed; today only review catches it.

## Fix shape (not decided)

The obvious check — any `.limit(<expr> + 1)` outside the owner fails — flags reads that are not
copies. In Q-Sports' Functions tree about seventeen remain, each reading N+1 for a different reason:
a designed refusal the user sees (an `HttpsError`), a flag the caller reports, a capacity check,
an existence probe, or a migration read outside a transaction that answers and skips instead of
throwing. As reviewed entries they would make the guard an inventory (RULE-STD-QUALITY-007). A
usable check needs a narrower shape: for example, a `transaction.get(… .limit(X + 1))` whose result
is compared against `X` and followed by `throw new Error(…)`, or an owner that also takes the
refusal to throw, so designed refusals route through it too and only the flag and probe reads stay
outside. A generic repo-guards check (packages-side), adopted by each app through its guard config
naming its owner.

## Done when

The check is in repo-guards with its own tests, each app registers it with its owner, and every
site it flags is moved onto the owner or carries a reviewed entry DJ approved.
