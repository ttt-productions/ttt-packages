# Adopt @ttt-productions/dev-standards 0.0.38

**What:** A new shared rule says nothing points at a temporary document, and a work item's header no longer has a "Came from" line.
**Severity:** medium

- **Package and version:** `@ttt-productions/dev-standards` 0.0.38.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`
- **What changed:** text only.
  - RULE-STD-QUALITY-206 (`rules/quality/documentation-and-drift.md`): a temporary document is one
    deleted when its work is done — a work item, an adoption file, a raw finding, a project's plan
    and step docs, a run or evidence folder, a scratch file. No document of any kind and no code or
    code comment names one. Whatever needs a fact from one states the fact itself, and work that
    depends on other work says what must be true, never the file that tracks it.
  - The codebase-hygiene playbook's step 27 gains a second search, for a pointer at a temporary
    document, and expects it to print nothing; the crosswalk maps the rule to that step.
  - `work/README.md`: the item header is What, Severity, and Trigger where the folder needs one.
    The "Came from" line is gone, an item names no session, review or run it came from, and an item
    never points at a temporary document.
  - `claude/CLAUDE.base.md` § Adoption files: an adoption file's header carries no "Came from".
- **What the app must change:** the install. Then every pointer at a temporary document comes out
  of ttt-prod's work items, design docs, rule files, runbooks, entry files and code: each one is
  rewritten to state the fact itself or to say what must be true.
- **Done when:** The lockfile names `@ttt-productions/dev-standards` 0.0.38 or later, and step 27's
  second search prints nothing in ttt-prod.
