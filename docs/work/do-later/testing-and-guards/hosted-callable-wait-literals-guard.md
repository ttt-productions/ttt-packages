# A guard against short hard-coded waits on a callable's response in hosted E2E

**What:** A check that fails when a hosted E2E spec or helper waits on a callable's response with a hard-coded timeout below the suite's callable commit budget.
**Severity:** medium
**Came from:** the ttt-prod hosted E2E TRIAGE session (chrome, mobile, msedge), after the second red of this class
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

A deployed dev callable can cold-start for well over a minute: a new instance boots, passes its
startup probe, then answers. ttt-prod's hosted suite holds one budget for a callable's commit,
`CALLABLE_COMMIT_BUDGET_MS` (90 s, set above the app's own 75 s callable deadline), and its
conventions say a callable-committed outcome waits that budget. Specs still hard-coded shorter
literals on `page.waitForResponse` (and similar waits), and each one turned a cold start into a red
that says nothing about the app:

- path 1 and path 2 on chrome: a 30 s literal over a 46 s and a 36 s cold start;
- path 2 on msedge: `requestPledgeRefund`'s 200 waited 60 s; dev Cloud Logging shows the new
  instance starting at 14:10:38Z and the request handled at 14:11:52Z, about 74 s.

The msedge red was fixed across the class: 82 sites in 19 path specs plus the Load-In special, and
three helper sites (`helpers/casting.ts` `reviewThresholdItem`, `helpers/safety-console-flow.mjs`
`getSafetyCaseConsole` and `decideTakeItDownValidity`), all now on `CALLABLE_COMMIT_BUDGET_MS`.
Longer literals sized for uploads, transcodes, and playback (120–600 s) were left alone. Nothing
stops a new short literal coming back; today only review catches it.

## Fix shape (not decided)

A static check over the hosted E2E tree (`e2e-hosted-dev/**` in ttt-prod): a wait on a callable's
response whose timeout is a numeric literal, or a `?? <literal>` default, below the commit budget
fails. A wait that names the budget constant, or a reviewed literal above it for a media or upload
step, passes. It runs as a hosted-harness vitest with its own tests (a planted short literal fails, the
budget constant passes).

Where it lives is part of the decision. The hosted harness is ttt-prod's today, so the first home is
ttt-prod's hosted-harness tests. If the hosted harness moves into a shared package for both products,
the check moves with it and each app registers it, so both products' suites are covered.

## Done when

The check exists with its own tests, it runs in the gate, and every callable wait it flags in the
hosted tree is on the budget constant or carries a reviewed reason DJ approved.
