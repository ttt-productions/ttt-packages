# Adopt @ttt-productions/query-core 0.14.38

**What:** `createCallablePolicy` builds the app's callable failure policy from its values; ttt-prod's `src/lib/callable-policy.ts` becomes those values; and the app config has no defaults, with a failed read and an invalid document reported apart.
**Severity:** medium

- **Package and version:** `@ttt-productions/query-core` 0.14.38.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:**
  - `./react` adds `createCallablePolicy(definition)` and its types
    (`CallablePolicyDefinition`, `CallableWording`, `CallableToastConfig`, `CallableBusinessAnswer`,
    `CallableRefusalRecognisers`, `CallablePolicyPlumbing`, `CallablePolicyKit`). It returns
    `{ policy, describeCallableError, captureCallableFault, isCallableRejection,
    isExpectedCallableAnswer, isAnswerSurfacedElsewhere, callableRejectionMessage,
    callableRefusalMessage }`. The classification, the order of checks, the reporting levels, and
    which case gets which toast live in the package; `createCallables` and `CallablePolicy` are
    unchanged. A failed call is routed, first match wins: the caller surfaces it itself → nothing;
    a business answer → its own action, no toast (also when the call is declared with no toast); no
    toast declared → nothing; a refusal declared answered → nothing; never sent because the token
    fetch's connection failed → the connection-dropped wording, nothing reported; never sent
    because App Check throttled or the token failed → the not-sent wording, a warning; the platform
    refused the ID or App Check token → the token-refused wording, a warning; the deadline passed →
    the outcome-unknown wording; maintenance → the maintenance wording with the operator's message;
    anything else → the generic error wording, an exception. An expected answer (a designed refusal
    code, maintenance, or a business answer) reports nothing; a recovered limited-use fallback still
    reports its warning. Only a callable rejection (a `functions/` code) lends its message as copy:
    `describeCallableError`, the generic toast, `callableRejectionMessage`, and
    `callableRefusalMessage` never show the message of any other failure (a client-side
    `TypeError`, an error with no callable code) — it gets the caller's `fallback` or the
    `genericError` slot. ttt-prod code or tests that expected a plain error's message there change
    with it.
  - `createAppConfig` no longer takes `defaults`, `readLevers`, or `extra` (`whileUnknown`
    included), and no longer returns `LOADING_APP_CONFIG` / `UNAVAILABLE_APP_CONFIG`;
    `onUnreadable` is renamed `onInvalid`. The app passes one validator, `read(stored | null)`,
    which returns the complete settings exactly as stored and throws when the document is missing,
    a setting is missing, or a value is invalid. The status is `loading`, `ready`, `unavailable`
    (the read failed), or `invalid` (the document was read and is missing or invalid; the error goes
    to `onInvalid`); `missing` no longer exists. `levers` exists only on `ready` — the state type
    carries it nowhere else. An `invalid` document leaves the listener running, so a fixed document
    becomes `ready` without a reload.
- **What the app must change:**
  - `src/lib/callable-policy.ts` becomes the values handed to `createCallablePolicy`, and the
    policy, describe function, and predicates it exports come from the returned kit:
    - `deadlineMs`: ttt-prod's callable deadline; `slowCallAfterMs`: its slow-call mark.
    - `wording`: every slot filled with ttt-prod's toast configs — `notSent`, `connectionDropped`,
      `tokenRefused`, `outcomeUnknown`, `maintenance`, `genericError`, `stillWorking`. The words
      written inline today, toast titles included, move into these slots (from ttt-prod's own
      notifications catalog where it has one). `notSent` and `connectionDropped` are new to
      ttt-prod: it has no handling today for a request that was never sent, which falls through
      as a generic error and an exception; give each its own words (the connection-dropped slot
      says the request was not sent because the connection dropped and asks to check the
      connection and try again).
    - `businessAnswers`: its three — acceptance required, email verification required, and content
      rejected — each as `{ recognise, respond }`, where `respond` is what ttt-prod does today
      instead of a toast. Every place that asks whether an answer is surfaced elsewhere uses the
      kit's `isAnswerSurfacedElsewhere`.
    - `refusals`: `isPlatformTokenRefusal` (auth-core) and its maintenance-refusal recogniser.
    - `plumbing`: `getFunctions`, `showToast` (ui-core's `toast`), `captureException` and
      `captureMessage` (monitoring-core), and `limitedUseAppCheck` (whether this build requests
      limited-use App Check — false under the emulators).
  - Its capture function takes the one name `captureCallableFault` (today
    `captureCallableRejection`); rename every caller.
  - Delete the hand-written classification, ordering, reporting, and routing from
    `src/lib/callable-policy.ts`, and the tests that proved them there; keep tests that prove
    ttt-prod's own values (its deadline, its wording, its business answers' actions).
  - **Supply an app-config validator.** Pass `read(stored | null)` from ttt-core in place of
    `defaults` and `readLevers`. Fold what `extra.read` produced into the validator's result, and
    give no setting a fallback value. The validator and the removal of ttt-prod's own app-config
    defaults are a change in its application-data package, ttt-core, made in ttt-prod's own
    session.
  - **Make `_appConfig/app` complete.** Bring the stored document in every environment to hold
    every setting with a valid value before deploying; a missing or incomplete document now shuts
    the site.
  - **Remove a leftover setting from the stored document.** A stored `_appConfig/app` that still
    carries a setting the schema no longer has is read as valid when every current setting is
    present and valid, so an old on/off maintenance flag is ignored — the maintenance message alone
    decides. Remove such a leftover field from the stored document.
  - **Show two statuses on two screens.** Show `unavailable` as the read-failure state with Try
    again, and `invalid` as a serious-error screen.
  - **Read levers only once ready.** Read `levers` only under `status === 'ready'`, including the
    version gate and any banner.
- **Done when:** the lockfiles name `@ttt-productions/query-core` 0.14.38 or later; no
  classification, ordering, reporting, or routing of a callable failure is written in ttt-prod's own
  code; a never-sent request shows its own words and reports at its stated level; ttt-prod builds
  with no reference to `defaults`, `LOADING_APP_CONFIG`, `UNAVAILABLE_APP_CONFIG`, or `extra` in its
  app config; its shell renders `unavailable` and `invalid` on their own screens, and its tests show
  a missing, incomplete, or bad document as `invalid` and a failed read as `unavailable`; the
  typechecks and ttt-prod's Normal Test Flow are green.
