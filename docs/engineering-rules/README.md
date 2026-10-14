# Engineering rules — ttt-packages

How code in **ttt-packages** must be created and changed. This is ttt-packages' own rulebook: it
governs every **generic** `@ttt-productions/*` package and names no consuming app. It is NOT:
package ownership and design (that's `docs/packages/` and `docs/design/`), audit procedure
(`docs/playbooks/`), or how an AI works with DJ (`docs/development-preferences.md`).

**App-data packages are not generic packages.** An app's application-data package (ARCH-207) is
governed by its own app's rulebook, never by this one.

## Mandatory reading protocol

- **Every package task** — review, investigation, planning, documentation, testing, or
  implementation: read this README and [core-rules.md](core-rules.md). Never from memory.
- **Then the area files the task touches** (routing below), read in full.
- **Then** `docs/packages/package-architecture.md`, the owning package's `docs/packages/*.md`, and
  the cross-cutting `docs/design/*.md` invariants it touches — then the current code, which is the
  implementation truth.

## Routing

| File | Read when the task touches |
|---|---|
| [architecture.md](architecture.md) | where code lives, ownership, a package's API, entries, dependencies, a shared contract, a release |
| [firestore.md](firestore.md) | a Firestore read or write, transaction, or batch inside a package |
| [frontend.md](frontend.md) | a React package: components, hooks, client state, pending/failure states, accessibility, motion |
| [media.md](media.md) | a media viewer or renderer package |
| [quality.md](quality.md) | tests, gates, lint, monitoring seams, docs — effectively every implementation task |
| [comments.md](comments.md) | writing, editing, or reviewing any code — every file carries comments |

## Spawned-agent contract (ENG-010)

Every prompt that spawns an implementation, design, or review agent names that agent's mandatory
reading — this README's routed files for its task plus the relevant package and design docs — as
explicit read-before-acting paths. An under-briefed agent requests its reading list rather than
proceeding; the orchestrator owns the violation.

## Rule IDs

`PREFIX-NNN`: `ENG`, `ARCH`, `BACKEND`, `FRONTEND`, `MEDIA`, `QUALITY`, `COMMENT`. IDs are permanent —
never renumbered, never reused. This rulebook is independent: an app's rulebook may use the same
number for its own rule, and the two never constrain each other. Code in this repo that cites a rule
ID means this rulebook's rule.

## Standard rule format

```md
### PREFIX-NNN — Title

**Rule.** The requirement.

**Why.** The failure this prevents.

**Prohibits.**
- Concrete recognizable violations.

**References.** Package docs, design docs, related IDs.
```

## Changing rules

- **Add:** next free number in the right file; update the owning playbook step in the same change
  (QUALITY-203).
- **Edit:** same ID.
- **Delete:** remove the whole block; never reuse its number; update every reference in the same
  change.
- **Conflict** between two rules, or between a rule and reality: surface it to DJ (ENG-008). Only
  DJ's explicit in-conversation instruction overrides this folder.
