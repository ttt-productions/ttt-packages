# Adopt @ttt-productions/dev-standards 0.0.5

**What:** ESLint presets reject `any` and lint config files; an agent proposal names each agent's tier.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.5.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `node/eslint` app and Functions presets: `@typescript-eslint/no-explicit-any` is on (error), source and tests.
  - Both presets also run the type-aware `@typescript-eslint/no-unsafe-assignment`, `-member-access`, `-call`, `-return` and `-argument` rules (error) on every `.ts` / `.tsx` file, source and tests, through the TypeScript project service: every linted TypeScript file must be included by its nearest `tsconfig.json`.
  - The app preset lints `*.config.js/ts`, `instrumentation.ts`, `instrumentation-client.ts` and `sentry.*.config.ts` (no longer ignored).
  - `@next/next/no-img-element` stays off, now with its reason beside it: RULE-STD-MEDIA-101 bans `next/image`, the replacement the rule demands.
  - An agent proposal names each agent's tier (`development-preferences.md` § Agents; `workflows/claude/fan-out-implementation.md` step 3).
  - Playbooks: the hygiene step for interaction semantics runs the new repo-guards guard "every dropdown carries an accessible name", and the UX audit's accessibility step expects every dropdown to be named.
  - Playbooks: a new hygiene step (122) runs the repo-guards guard "no promise rejection is discarded without a reason"; the crosswalk lists it under RULE-STD-ENG-009, RULE-STD-COMMENT-001 and RULE-STD-QUALITY-007.
- **What the app must change:** Install. Make sure every linted TypeScript file (source, tests, config) is included by a `tsconfig.json` the ESLint project service finds. Fix every `no-explicit-any` and `no-unsafe-*` finding the presets now report (a real type, or a typed cast with a one-line reason for a genuine vendor gap) and every lint finding in the newly linted config and instrumentation files.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.5 or later, and the gate is green.
