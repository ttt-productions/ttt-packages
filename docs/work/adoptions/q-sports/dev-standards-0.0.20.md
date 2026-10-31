# Adopt @ttt-productions/dev-standards 0.0.20

**What:** RULE-STD-BACKEND-010 now allows an app's hosted end-to-end harness its own dev-only App Check debug token.
**Severity:** low
**Came from:** the ttt-prod triage-batch session (the hosted harness's reCAPTCHA throttle on long nights)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.20.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:**
  - RULE-STD-BACKEND-010: an App Check debug token is a bypass for local runs, CI, and the app's hosted
    end-to-end harness. It still never reaches a deployed config, secret, or bundle, and a deployed
    app's own clients still attest only through the real provider. The hosted harness may present a
    token registered on the dev project only, held in the harness's own untracked env and set only in
    the browser pages it drives, with at least one harness engine kept on the real provider every run.
    No debug token is ever registered on the production project.
  - The codebase-hygiene playbook step 29 (local config alignment) audits the harness token where an
    app has one.
- **What the app must change:**
  - Install.
  - Nothing else unless Q-Sports' hosted suite takes up a harness token. If it does (the fix for a
    hosted engine throttled by reCAPTCHA bot-scoring after hours of runs), follow the rule: register a
    token on the dev project only, keep it in the hosted suite's untracked env, set it in the harness's
    pages through an init script on the throttled engines only, keep one engine on real reCAPTCHA, fail
    a run at pre-flight when the token is missing, keep the variable out of every deployed config and
    deployed source tree with a guard or test, and name the variable, the engines, and that check in
    Q-Sports' own `backend/core-rules.md` under a RULE-STD-BACKEND-010 addition.
  - Check Q-Sports' docs that restate "debug token is local/CI only" (its `CLAUDE.md`, hosted-suite
    design and conventions docs) and align them with the rule.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.20 or later, and any Q-Sports
  doc that restated the old wording matches the rule.
