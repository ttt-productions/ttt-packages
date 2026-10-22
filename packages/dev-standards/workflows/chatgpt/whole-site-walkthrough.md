---
name: chatgpt-whole-site-walkthrough
description: ChatGPT/Codex workflow (Find problems). Use when DJ wants the live site walked like a real user — pages and journeys, what it communicates, what is unclear, and what could be better.
---

# Whole-site walkthrough

**AI:** ChatGPT/Codex
**Jobs:** Find problems
**Use it when:** DJ wants the live site walked like a real user — pages and journeys, what it communicates, what is unclear, and what could be better.
**Kickoff:** `Run the <APP_NAME> development workflow chatgpt/whole-site-walkthrough[, resume <run>][, area <where to start>].`
**Reads from / writes to:** browses hosted dev; reads `<APP_NAME>` source as reference; writes ONLY its run folder `docs/work/raw-findings/whole-site-review/` (or a new `docs/work/raw-findings/whole-site-review-<slug>/` when DJ starts a fresh one).

Starting this workflow is DJ's in-conversation authorization for hosted-dev browser access, and only
that. A run marked PAUSED in its `progress.md` stays paused until DJ says to resume it.

## Resume or start

1. The normal preflight (`CLAUDE.md`, `AGENTS.md`, the shared and the app's rulebook README + core
   rules, RULE-STD-ENG-001); route additional rules and design docs to the area being reviewed.
2. Read the run's `progress.md`, `coverage.md`, `findings.md`, and the selected page/journey notes.
3. Inspect the current browser state; never assume the previous session, account, deployment, or
   element IDs are still current.
4. Briefly state the next proposed destination. DJ directs which area to review; explore that area
   independently, then discuss and offer the next destination or the remaining list.

## Scope and method

- Browser: hosted dev at `<HOSTED_DEV_URL>`. Local implementation reference: `<APP_REPO>` and the
  applicable shared packages in `<PACKAGES_REPO>`. No GitHub, Git history/change discovery,
  production, or hosted infrastructure inspection.
- Review complete pages and real journeys: purpose, information hierarchy, discoverability,
  navigation, roles, state changes, business promises, recovery, and the architecture supporting the
  experience. Not a fine-detail lint review.
- Read the rendered experience first. Separate what the interface explains from what the reviewer can
  infer or learn from code; model comprehension is not evidence an ordinary newcomer will understand.
- Inspect tabs, buttons, menus, expanded sections, dialogs, and meaningful states. Record actions and
  outcomes; seeing a link does not prove its destination works. DJ's authorization for test
  interactions is not blanket permission for payments, destructive actions, messages, or new
  privileges.
- Identify useful placements for the existing common Help component (required written explanation,
  optional video); inspect its actual owner before suggesting implementation. Help answers the
  decision at hand; it never hides information required to act safely.
- Keep discussion short and high-level. At an area's end explain
  what it communicates, what is unclear, and where to go next. DJ chooses direction.
- No screenshots or image copies unless DJ explicitly asks. Existing local test fixtures may be used
  when directed; their upload category does not establish actual authorship.
- Writes only inside the run folder. App/package changes need a separate explicit implementation
  instruction. Never create a parallel rulebook, help system, or plan.

## The run's records

- `progress.md` — exact stopping point, next action, environment uncertainty, reference reading.
- `coverage.md` — area status and links to page-level control ledgers; provisional until a complete
  route/role map exists. No coverage percentage until the scope denominator is established.
- `findings.md` — authoritative findings with stable WSR IDs, evidence, consequence, recommendation,
  confidence, severity, and decision status. Other files reference IDs, never duplicate findings.
- `pages/`, `journeys/` — observed purpose/content, control ledgers, role/state, current-versus-future
  copy, missing evidence; cross-page process and consistency comparisons.
- `evidence/` — selected screenshots and provenance only when DJ asked. Never passwords, email-action
  tokens, or other credentials.
- Any phase plan DJ adds (e.g. `admin-review-plan.md`) supplements this method, never replaces it.

After each page or small journey, save notes and update coverage. Before stopping, update
`progress.md` with the exact next action. A failed click, an unvisited state, and a pending
current-version recheck stay explicit. After deployments, mark affected observations for recheck.

Observations are provisional while exploration continues: when a later page answers a concern,
update the existing finding. Distinguish confirmed defects, placement suggestions, unanswered
questions, and known user-owned issues.

## Finish

Every agreed page/role/state has an outcome or an explicit unreviewed reason; key journeys are
connected end-to-end; Help placements and cross-page inconsistencies are assessed. Reconcile the
notes into the final list of remaining flaws and proposed fixes, prioritizing consequential patterns.
That list is raw findings: deciding it is the `go-through-findings` workflow, with DJ.
