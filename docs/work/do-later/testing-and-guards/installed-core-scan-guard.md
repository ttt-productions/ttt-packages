# The guards also scan the app's installed application-data package

**What:** A repo-guards option that runs the source checks an app already runs over its own code over its installed application-data package too (q-core in Q-Sports, ttt-core in ttt-prod), so the core's code is held to the same rules.
**Severity:** low
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

Before q-core moved into ttt-packages, Q-Sports' hygiene suite scanned q-core's source beside `src/`
and `functions/src/`. After the move neither app's guards scan its core's own code: q-core is treated
exactly as ttt-prod treats ttt-core. Only the core's root purity is still guarded, by ttt-packages'
boundary suite (`test/boundary/leak-config.ts`).

Checks no core gets today, which each app's guards already run over its own code:

- RULE-STD-ARCH-104: no string-literal path segment and no hand-assembled slash path outside the
  core's `paths/` builders, which are the owner.
- RULE-STD-BACKEND-307: no payment-service name, package, or credential.
- Each app's own source rules that apply to its core (Q-Sports: RULE-QS-SPORT-901, no game-stats
  history array).

## The shape

One repo-guards option, not a hand-made change in each app: an app's guard config names its
installed application-data package, and the source guards that take it read that package's code
from `node_modules/@ttt-productions/<core>/dist` — the version the app actually ships — alongside the
app's own roots. The compiled `.js` (or the declaration files, where they are the better source) is
what those files hold, so each guard is confirmed to read that form correctly before it is trusted.
The core's own `paths/` builders stay the sanctioned owner of path segments.

Generic: the option takes the package name and any per-guard exemption from the app's config; it
names no app (RULE-STD-ARCH-201).

**Done when:** repo-guards ships the option, both apps' guard configs name their core, each guard
that takes it has a named anchor proving the scan reaches the core, and both apps' gates are green.
