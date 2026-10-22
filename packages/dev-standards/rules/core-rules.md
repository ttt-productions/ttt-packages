# Universal engineering rules (ENG)

Mandatory reading for every conversation in every app and in ttt-packages. These rules apply to all work; the area folders sharpen them per domain. Format, scope, and ID conventions: [README.md](README.md).

### RULE-STD-ENG-001 — Read the governing context
**Scope.** both

**Rule.** Every conversation reads the shared rulebook's README and this file before acting, and in an app then the app's own rulebook README and `core-rules.md`. Work in a focused area reads that area's routed rule files, shared and app; work involving a system reads its design docs (an app's `docs/design/*.md`; for a package, ttt-packages' `docs/packages/*.md` and `docs/design/*.md`); implementation and review then inspect the current code, which is the implementation truth.

**Why.** Every parallel-system failure this rulebook exists to prevent starts with acting on assumptions instead of the written system.

**Prohibits.**
- Designing, editing, or reviewing before the routed reading is done.
- Treating rules or architecture as "remembered" from an earlier task or session.

**References.** README routing table; RULE-STD-ENG-010 for spawned agents.

### RULE-STD-ENG-002 — One change point
**Scope.** both

**Rule.** Every repeated behavior, contract, definition, and visual pattern has exactly one authoritative implementation; changing the concept once must propagate everywhere it is used. This covers business-logic cores, schemas, constants, paths, option maps, business copy, callable clients, UI components and styling patterns, upload paths, media rendering, and error handling.

**Why.** Two copies of one truth always drift; the second copy is a latent bug from the day it is written.

**Prohibits.**
- Re-declared local copies of a canonical union, constant, map, or component.
- "Keep in sync" comment pairs — the fix is consolidation, not a reminder.
- A literal at an enforcement point where a canonical declaration exists.

**References.** RULE-STD-ARCH-102 (declarations), RULE-STD-FRONTEND-001 (UI patterns), RULE-STD-ARCH-001 (cores).

### RULE-STD-ENG-003 — Extend existing owners; no parallel systems
**Scope.** both

**Rule.** Implementation work finds and extends the existing owner — core, pipeline, writer, state machine, renderer, component, or package. New entry points adapt to the existing owner instead of recreating its logic or state. When unsure whether an owner exists, search the code and ask before building.

**Why.** A second implementation built beside an owner that already serves the case — its own state machine, worker, and schema — is a second truth from the day it is written, and usually a weaker one; the right design extends the one owner.

**Prohibits.**
- A second scanner, upload path, core, state machine, notification lane, or renderer for a domain that has one.
- "It was faster to build my own" as a justification for duplication.

**References.** RULE-STD-ARCH-001, RULE-STD-ARCH-002, RULE-STD-ARCH-003, RULE-STD-ARCH-004; RULE-STD-MEDIA-001; RULE-STD-BACKEND-306; RULE-STD-FRONTEND-001.

### RULE-STD-ENG-004 — Behavior lives where its concept is owned
**Scope.** both

**Rule.** Generic mechanisms live in their owning generic package; an app's contracts and business definitions live in `<APP_DATA_PACKAGE>`; entry points and app adapters stay thin, and an app's `src/` and `functions/src` own wiring — routes, composition, layout — never truths. A generic package never holds an app's identifiers, paths, policy, or copy: the app supplies them through the package's factory, adapter, callback, or configuration.

**Why.** A definition living in one app layer is a copy waiting to happen the moment a second consumer needs it.

**Prohibits.**
- App-local definitions of cross-boundary shapes, constants, or copy.
- An app's identifiers, paths, policy, or copy pushed into a generic package.
- A mechanism split across two packages that each own half of it.

**References.** RULE-STD-ARCH-101, RULE-STD-ARCH-201, RULE-STD-ARCH-205, RULE-STD-ARCH-207; ttt-packages' `docs/packages/package-architecture.md`.

### RULE-STD-ENG-005 — Derive from canonical definitions
**Scope.** both

**Rule.** Enforcement and presentation import canonical schemas, constants, paths, types, option maps, and copy instead of restating them: zod `.max(MAX_X)`, `maxLength={MAX_X}`, type positions referencing the canonical union.

**Why.** A restated value is drift by definition — updating the concept must touch one place.

**Prohibits.**
- Bare numeric limits or quoted union members outside the defining file and its reviewed guard allowlists.
- Local DTOs justified by "avoids an `<APP_DATA_PACKAGE>` publish" (auto-reject).

**References.** RULE-STD-ARCH-102; the repo-guards suite's core-definition guards.

### RULE-STD-ENG-006 — The backend is the security boundary
**Scope.** both

**Rule.** Client behavior is user experience, never authority. Untrusted input is validated before use; identity, permissions, sensitive state, and privileged effects are verified and enforced server-side, and every precondition the UI checks is re-checked by the backend path that performs the action. A client package never writes privileged state; a package server helper enforces on the server.

**Why.** Anything the client can send, an attacker can send without the UI.

**Prohibits.**
- Client writes to role, status, money-adjacent, moderation, or admin-curated state.
- Trusting client-supplied identity, paths, targets, or ownership hints — in app code or a package helper.
- A dev/emulator branch that bypasses a security check outside the sanctioned emulator pattern (RULE-STD-BACKEND-308).

**References.** RULE-STD-BACKEND-001; RULE-STD-BACKEND-201; RULE-STD-ARCH-005, RULE-STD-ARCH-106; RULE-STD-MEDIA-004.

### RULE-STD-ENG-007 — Behavior, tests, and documentation move together
**Scope.** both

**Rule.** A behavior change updates the tests that prove it and the design or package docs that describe it in the same work. Verification is proportional to risk; a fixed defect gets a regression test that reproduces it.

**Why.** Docs and tests that lag the code stop being safety equipment and start being misinformation.

**Prohibits.**
- Shipping a flow change with a stale design or package doc "to update later".
- Fixing a bug without a test that would have caught it.

**References.** RULE-STD-QUALITY-001, RULE-STD-QUALITY-201, RULE-STD-QUALITY-203.

### RULE-STD-ENG-008 — Surface discovered problems
**Scope.** both

**Rule.** When work reveals duplication, inconsistency, drift, or bad code — or code, a doc, and a rule disagree — it is surfaced with evidence and a recommended fix, never silently resolved, worked around, or papered over. Small, unambiguous documentation drift may be corrected directly; substantive drift is surfaced.

**Why.** Silently ignored drift compounds; silently expanded scope breaks trust in every diff.

**Prohibits.**
- Working around a discovered defect without reporting it.
- Expanding the task to fix unrelated findings.

**References.** RULE-STD-QUALITY-202.

### RULE-STD-ENG-009 — Fail truthfully and visibly
**Scope.** both

**Rule.** Never report success for required work that failed. **Apps:** expected errors surface through the canonical user-facing path; unexpected failures are captured to monitoring; asynchronous obligations use the established durable outbox/retry model — and post-commit best-effort work never converts a committed action into a reported failure. **Packages:** a package surfaces a failure to its consumer through its documented seam (a thrown error, a result, an `onError` callback), never by swallowing it.

**Why.** A false success is worse than a failure: it removes the signal that would have gotten it fixed.

**Prohibits.**
- Swallowed errors without capture; a failure mapped to a default that reads as data.
- Failing a callable after its primary state already committed.
- "Done" claims for unverified or skipped work — in code and in conversation.

**References.** RULE-STD-BACKEND-301, RULE-STD-BACKEND-302; RULE-STD-QUALITY-101, RULE-STD-QUALITY-102, RULE-STD-QUALITY-104; RULE-STD-FRONTEND-206.

### RULE-STD-ENG-010 — Spawned agents inherit the rules
**Scope.** both

**Rule.** Every prompt that spawns an implementation, design, or review agent names that agent's mandatory reading — the routed rule files for its task area, shared and app, plus the relevant design or package docs — as explicit paths to read before acting. The orchestrator routes; a spawned agent whose prompt lacks a reading list requests it rather than proceeding.

**Why.** An agent whose prompt never routed it to the design system invents its own — a parallel palette, a second component. Rules that aren't delivered don't exist.

**Prohibits.**
- Spawning an implementer with task text but no reading list, or a spawned agent "helpfully" proceeding without its governing context.

**References.** README § Spawned-agent contract; RULE-STD-FRONTEND-003.

### RULE-STD-ENG-011 — Once data is live, persisted shapes change with a migration path
**Scope.** apps

**Rule.** Binds once `<HOLDS_LIVE_DATA>` is yes. Any change to a persisted shape — Firestore field, document ID convention, custom claim, Storage path — ships with the migration bringing existing documents to the new shape; a change that runs against live documents before its migration completes also ships a read path tolerating both shapes until it does. Migrations are idempotent, safely re-runnable, and belong to the work that forces them.

**Why.** Once production holds real records with no wipe available, a shape change without a migration silently breaks live records, and a migration that cannot be re-run cannot be recovered when it fails halfway.

**Prohibits.**
- A new field shape while old documents hold the old one and no migration or tolerant read covers them.
- A migration that corrupts or double-applies when re-run.
- Deferring the migration while the writing code ships now.

**References.** RULE-STD-BACKEND-114; RULE-STD-ARCH-204; RULE-STD-QUALITY-001.
