# Quality — documentation & drift (RULE-STD-QUALITY-200–299)

Format, scopes, and rule IDs: [../README.md](../README.md).

Topic file routed with `quality/`. Read when a task touches design docs, package docs, playbooks, entry files, a rules folder, or the doc taxonomy. These rules sharpen RULE-STD-ENG-007 (behavior, tests, and docs move together) and RULE-STD-ENG-008 (surface discovered problems) for documentation upkeep.

### RULE-STD-QUALITY-201 — Docs match the current implementation
**Scope.** both

**Rule.** A design doc (`docs/design/`) or package doc (`docs/packages/`) always reflects how the system works today. A behavior change — a new or removed flow, changed architecture, a corrected field name, an updated function signature or export, a fixed code example — updates the affected doc in the SAME work. Code is the implementation truth; when a doc and the code disagree, surface it (RULE-STD-ENG-008) and never silently pick one. A doc's status markers are part of its content: "planned", "proposed", "not yet built" are updated in the change that ships (or drops) the feature, and one behavior has one statement — two sections of a doc, or two docs, that state it differently are drift even when one of them matches the code.

**Why.** A doc that lags the code becomes misinformation the next reader trusts as current — a built feature still marked "planned", a self-contradicting rule, or a procedure promising a user something the code never does each sends a reader the wrong way.

**Prohibits.**
- Shipping a behavior change with a stale doc "to update later".
- A doc describing a flow, field, signature, or export the code no longer has.
- A built feature still labelled planned, proposed, or not yet built (or an unbuilt one described as built); two statements of one behavior that disagree.

**References.** RULE-STD-ENG-007, RULE-STD-ENG-008; RULE-STD-QUALITY-205.

### RULE-STD-QUALITY-202 — No drift-prone inventories in permanent docs
**Scope.** both

**Rule.** Permanent docs — design docs, package docs, and playbooks — do not maintain exhaustive living inventories of the current variables, functions, domains, package exports, files, or paths. Prefer a durable rule, a small illustrative example, or a grep, guard, or playbook check. If a table exists only to mirror code, delete it or move the active item into `docs/work/`.

**Why.** An inventory that mirrors code drifts the moment code changes and quietly becomes wrong — the opposite of the reference it pretends to be.

**Prohibits.**
- A doc or playbook table that restates a code list solely to enumerate it.
- A permanent hand-synced inventory of sensitive actions, exports, or paths.

**References.** RULE-STD-ENG-008; RULE-STD-QUALITY-007.

### RULE-STD-QUALITY-203 — New or changed patterns update the owning playbook step
**Scope.** both

**Rule.** When work introduces or changes an engineering pattern, system, or convention, it updates the playbook step that audits it — the owning shared playbook step, or the app's addition step — or adds one, in the SAME change, so future audits catch drift from the new pattern. The design doc describes how the system works; the playbook step describes how to verify the code still follows it. Both move together. A playbook step cites the rule IDs it audits; a rule never cites a playbook step, so a step added, moved, or renumbered changes no rule. A step whose **Expected** states an exact list — of files, callables, origins, exports, or fields — derives that list from a named script, guard test, or canonical constant the step cites, so the code itself forces the doc edit; a hand-synced list is prohibited (RULE-STD-QUALITY-202), and where no such source exists the step states the durable property to check instead of enumerating today's answer.

**Why.** A pattern with no audit step is unenforced and drifts silently until the next unrelated task trips over it. A hand-synced exact list is worse than no list: the audit reads as authoritative while quietly grading the code against last quarter's inventory.

**Prohibits.**
- A new system or convention that gets a design doc but no matching audit step.
- Changing a pattern's shape without updating the step that audits it.
- An exact-list **Expected** with no named script, guard, or constant behind it.
- A rule citing a playbook step.

**References.** [../../playbooks/README.md](../../playbooks/README.md); RULE-STD-ENG-007; RULE-STD-QUALITY-201, RULE-STD-QUALITY-202.

### RULE-STD-QUALITY-205 — Doc taxonomy: each home keeps its distinct purpose
**Scope.** both

**Rule.** Engineering rules, design docs, package docs, playbooks, runbooks, and the `AGENTS.md`/`CLAUDE.md` entry files keep separate purposes, and no doc duplicates another's content: engineering rules are how software must be built (stable IDs); design docs are how a system works and why; package docs are what a package owns, exposes, and guarantees; playbooks are how an AI audits the code; runbooks are what a human does in an operation; entry files are the values block, mandatory-reading links, repo map, essential commands, and ownership boundaries, with how an AI works with DJ in the shared `development-preferences.md`. Factual overlap links to the canonical rule ID rather than restating the rule.

**Why.** A rule copied into a design doc or an entry file becomes a competing, drifting second source of truth — exactly what the one-change-point principle forbids.

**Prohibits.**
- An engineering rule catalog living in a design doc, a package doc, or an entry file.
- A design/system explanation pasted into an engineering rule (link the design doc instead).
- A findings list kept in a playbook (playbooks are methodology only).

**References.** [../README.md](../README.md); [../../playbooks/README.md](../../playbooks/README.md); [../../development-preferences.md](../../development-preferences.md); RULE-STD-ENG-001, RULE-STD-ENG-002.

### RULE-STD-QUALITY-206 — Nothing points at a temporary document
**Scope.** both

**Rule.** A temporary document is one that is deleted when its work is done: a work item in any `docs/work/` folder, an adoption file, a raw finding, a project's plan and step docs, a run or evidence folder, a scratch file. No document of any kind names one: not a rule, a design doc, a runbook, a playbook, a workflow, a package doc, an `AGENTS.md`/`CLAUDE.md` entry file, a work item, or an adoption file. No code or code comment names one either. Whatever needs a fact from a temporary document states the fact itself. Where one piece of work depends on another, it says what must be true — the package version installed, the thing that must exist — and never the file that tracks it.

**Why.** A temporary document is deleted on purpose, so every pointer at one goes dead, and whatever leaned on it loses part of its meaning with it. A work item must carry everything needed to build it; a permanent doc must stay true after the work it mentions is finished.

**Prohibits.**
- A work item, adoption file, or permanent doc naming another work item, an adoption file, a raw finding, a project plan or step doc, a run or evidence folder, or a scratch file, by path or by file name.
- "The same design as that item", "that item removes it", "waits on that item", "adopt together with that item": the design, the removal, or the condition is stated in the document itself.
- A code comment or test title that names a work item or a run.

**References.** RULE-STD-QUALITY-201, RULE-STD-QUALITY-205; RULE-STD-ENG-007; [../../work/README.md](../../work/README.md).
