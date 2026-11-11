# Adopt @ttt-productions/repo-guards 0.1.40

**What:** The `appCheck` guard takes consuming gates: another auth call whose callables also consume their App Check token.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.40.
- **Release:** `./scripts/release-multiple.sh repo-guards q-core patch`.
- **What changed:**
  - `AppCheckFacts` gains a required `consumingGates` list. Each entry names a gate `call` and its own
    `exempt` list (`{ callable, why }`). Every callable in a file that calls the gate must declare
    `consumeAppCheckToken: true` unless that gate's `exempt` names it. A gate exemption whose
    callable is gone, calls no such gate, or now consumes is stale, and the client half flags a
    limited-use declaration of a gate-exempt callable as it does a `consumptionExempt` one.
  - A missing `consumingGates`, a gate with no call, a gate named twice, or an exemption with no why
    is a fact problem.
- **What the app must change:** Install, then add `consumingGates: []` to the `appCheck` facts in
  `src/__tests__/guards/config/backend.ts`, or name a gate there if one of ttt-prod's own auth calls
  admits callers that should spend their token.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.40 or later, the `appCheck`
  facts carry `consumingGates`, and the guard suite's App Check checks pass.
