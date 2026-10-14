# Universal rules (ENG)

Mandatory reading for every package task. Format and IDs: [README.md](README.md).

### ENG-001 — Read the governing context

**Rule.** Every task reads this rulebook's README and this file before acting, then the routed area
files, the package docs for what it touches, and the current code, which is the implementation
truth.

**Why.** Every parallel-system failure starts with acting on assumptions instead of the written system.

**Prohibits.**
- Designing, editing, or reviewing before the routed reading is done.
- Treating rules or package architecture as remembered from an earlier task.

**References.** README routing; ENG-010.

### ENG-002 — One change point

**Rule.** Every repeated behavior, contract, definition, and visual pattern has exactly one
authoritative implementation; changing the concept once propagates everywhere it is used. This covers
cores, schemas, constants, option maps, components, styling patterns, and error handling.

**Why.** Two copies of one truth always drift.

**Prohibits.**
- Re-declared local copies of a canonical union, constant, map, or component.
- "Keep in sync" comment pairs — the fix is consolidation.
- A literal at an enforcement point where a canonical declaration exists.

**References.** ARCH-102, FRONTEND-001, ARCH-001.

### ENG-003 — Extend existing owners; no parallel systems

**Rule.** Work finds and extends the existing owner — package, core, state machine, renderer,
component, hook. A new entry point adapts to the owner instead of recreating its logic or state.
When unsure whether an owner exists, search and ask before building.

**Why.** A parallel implementation is a second truth from the day it is written.

**Prohibits.**
- A second core, state machine, renderer, or upload path for a concern that has one.
- "It was faster to build my own."

**References.** ARCH-001, ARCH-004.

### ENG-004 — Behavior lives where its concept is owned

**Rule.** A generic mechanism lives in the generic package that owns the concept. App-specific
contracts, business definitions, identifiers, paths, policy, and copy never live in a generic
package — the app supplies them through the package's factory, adapter, callback, or configuration
(ARCH-201).

**Why.** A definition in the wrong home is a copy waiting to happen.

**Prohibits.**
- A generic package holding an app's identifiers, paths, policy, or copy.
- A mechanism split across two packages that each own half of it.

**References.** ARCH-201, ARCH-207; `docs/packages/package-architecture.md`.

### ENG-005 — Derive from canonical definitions

**Rule.** Enforcement and presentation import canonical schemas, constants, types, and option maps
instead of restating them.

**Why.** A restated value is drift by definition.

**Prohibits.**
- Bare numeric limits or quoted union members outside the defining file and its reviewed guard
  allowlists.

**References.** ARCH-102.

### ENG-006 — The backend is the security boundary

**Rule.** Client-side package code is user experience, never authority. Package server helpers
(auth assertion, validation, signature verification) enforce on the server; a client package never
writes privileged state or trusts client-supplied identity, paths, or targets.

**Why.** Anything a client can send, an attacker can send without the UI.

**Prohibits.**
- A client package writing role, status, money-adjacent, moderation, or admin state.
- A package helper that trusts a client-supplied identity or target.

**References.** ARCH-005.

### ENG-007 — Behavior, tests, and documentation move together

**Rule.** A behavior change updates its tests and the package/design docs that describe it in the
same work. A fixed defect gets a regression test that reproduces it.

**Why.** Lagging docs and tests become misinformation.

**Prohibits.**
- A behavior change with a stale package doc "to update later".
- A bug fix without a test that would have caught it.

**References.** QUALITY-001, QUALITY-201, QUALITY-203.

### ENG-008 — Surface discovered problems

**Rule.** When work reveals duplication, inconsistency, drift, or bad code — or code, a doc, and a rule disagree — it is surfaced with evidence and a recommended fix, never silently resolved, worked around, or papered over. Small, unambiguous documentation drift may be corrected directly; substantive drift is surfaced.

**Why.** Silently ignored drift compounds; silently expanded scope breaks trust in every diff.

**Prohibits.**
- Working around a discovered defect without reporting it.
- Expanding the task to fix unrelated findings.

**References.** QUALITY-202.

### ENG-009 — Fail truthfully and visibly

**Rule.** Never report success for required work that failed. A package surfaces failures to its
consumer through its documented seam (a thrown error, a result, an `onError` callback) — never by
swallowing them or returning a value its consumer cannot tell from success.

**Why.** A false success removes the signal that would have gotten it fixed.

**Prohibits.**
- Swallowed errors.
- A failure mapped to a default that reads as data.
- "Done" claims for unverified or skipped work.

**References.** FRONTEND-206; QUALITY-102.

### ENG-010 — Spawned agents inherit the rules

**Rule.** Every prompt that spawns an implementation, design, or review agent names that agent's
mandatory reading as explicit read-before-acting paths. A spawned agent without a reading list
requests it rather than proceeding.

**Why.** Rules that are not delivered do not exist.

**Prohibits.**
- Spawning an implementer with task text but no reading list.

**References.** README § Spawned-agent contract.
