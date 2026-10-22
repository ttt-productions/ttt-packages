# Comment rules (COMMENT)

What a comment may say, and what it may never say, in every app and in every package. **This file is read in full for any task that writes, edits, or reviews code** — source, tests, scripts, config, and `firestore.rules` / `storage.rules` — because every file carries comments. A test name is held to these rules too (RULE-STD-COMMENT-009). Read with [../README.md](../README.md) and [../core-rules.md](../core-rules.md).

A comment these rules do not settle — bad in a way no rule names, or good but caught by a rule that would remove it — goes to DJ as a proposed new rule or a proposed edit to an existing one. DJ decides; no work ever makes, edits, or stretches a rule itself. An approved rule takes the next free number, and an edited rule keeps its own.

### RULE-STD-COMMENT-001 — No comment unless the code cannot say it
**Scope.** both

**Rule.** The default is no comment. A comment exists only when a reader — a person or an AI — reading the code cannot work out what it says, and only as one of three kinds: (1) a required marker a rule or guard looks for (the list below); (2) an exception — the code deliberately breaks a rule or pattern, and the comment names the rule ID and gives the reason in one line, so the next reader does not "fix" it back; (3) a constraint the code cannot show — a platform limit, a vendor or runtime quirk, or an ordering trap that lives outside the code but breaks it ("mocks must precede the component import"). It describes the code as it stands and is as short as that allows.

**Why.** A comment rots the moment the code moves, and humans and agents still read it as current truth. Code, names, types, and tests state what the code does; package and design docs state its contract.

**Prohibits.**
- Any comment outside the three kinds — including a file or module header that says what the file holds, a doc comment (JSDoc) that restates a signature or describes what a function, type, or exported API does, a walkthrough of how something works, and a section divider or label.
- An exception that does not name the rule ID and the reason.
- One explanation repeated file after file.

**References.** The required markers — each a comment this rule keeps, and a sweep never removes one: RULE-STD-ARCH-206 (`SANCTIONED EXCEPTION`), RULE-STD-BACKEND-002 (`.passthrough()` reason), RULE-STD-BACKEND-010 (App Check omission reason), RULE-STD-BACKEND-013 (in-file rate-limit decision), RULE-STD-BACKEND-119 (refuse-instead-of-clamp exception), RULE-STD-BACKEND-301 (the post-commit marker), RULE-STD-FRONTEND-002 (the utility an `overrides.css` rule beats), RULE-STD-FRONTEND-102 (raw `staleTime` justification), RULE-STD-QUALITY-006 (reasoned `eslint-disable-next-line`, `prettier-ignore` reason), RULE-STD-QUALITY-007 (guard allowlist justification), RULE-STD-QUALITY-009 (a reviewed entry's why). A rule that adds a required comment joins this list in the same change. RULE-STD-ENG-002 (no "keep in sync" pairs); RULE-STD-COMMENT-012 (no security mechanism).

### RULE-STD-COMMENT-002 — No dates
**Scope.** both

**Rule.** A comment carries no date of any kind. A date that is a VALUE the code depends on — an external API version string, a legal effective date — is data, not a comment date.

**Why.** A date is true only on the day it was written; after that the reader cannot tell whether the comment still holds.

**Prohibits.**
- Stamps and "as of" dates: `2026-07-10`, `July 2026`, `as of Q3`, `live 2026-07-31`, `fixed 2026-07-10`.

**References.** RULE-STD-COMMENT-005 (history).

### RULE-STD-COMMENT-003 — No line numbers
**Scope.** both

**Rule.** A comment never cites a line number. To point at code, it names the function, constant, type, or file.

**Why.** Line numbers move with every edit above them, so the reference goes wrong silently.

**Prohibits.**
- `route.ts:65`, `lines 678-681`, `~line 495`, "see line 12".

**References.** RULE-STD-COMMENT-010 (references that cannot drift).

### RULE-STD-COMMENT-004 — No ticket names or work labels
**Scope.** both

**Rule.** A comment carries no tracking-doc name, ticket ID, or work-plan label.

**Why.** Tracking docs are deleted when the work finishes, and the label then points at nothing.

**Prohibits.**
- `CODE_CHANGE_*` names; "Phase 6", "item 3", "FINDING 10", "Wave 2", "Batch 4", "P3", "[F16]", "§A7"; launch-plan or other plan step names used as labels; review-round tags.

**References.** RULE-STD-COMMENT-009 (the same labels in test names), RULE-STD-COMMENT-010.

### RULE-STD-COMMENT-005 — No history
**Scope.** both

**Rule.** A comment describes what the code does and why, today. It never tells the story of how the code got this way.

**Why.** The history of the code lives in git; in a comment it is noise that goes stale.

**Prohibits.**
- "previously", "used to", "was changed to", "now uses", "fixed", "replaced the old X" — about the CODE. A comment about runtime state ("a profile that no longer exists") is not history.
- A regression test telling the incident; it states the failure it prevents.

**References.** RULE-STD-COMMENT-002, RULE-STD-COMMENT-007; RULE-STD-QUALITY-001 (a fixed defect ships a regression test).

### RULE-STD-COMMENT-006 — No people or review sources
**Scope.** both

**Rule.** A comment never names who decided, requested, reviewed, or found something. A decision is written as standing fact.

**Why.** Who decided is not the reason; the reason is what the reader needs.

**Prohibits.**
- "DJ ruling", "DJ-approved", "DJ product decision", "per the Codex review", "ChatGPT flagged", "the reviewer found", "the orchestrator".

**References.** RULE-STD-COMMENT-001.

### RULE-STD-COMMENT-007 — No narrating the obvious, no change notes
**Scope.** both

**Rule.** A comment never restates what the next line plainly does, and never records what an edit changed.

**Why.** The code already says what it does, and the diff is the record of what changed.

**Prohibits.**
- `// increment the count`, `// call the API`.
- "added X", "changed Y to Z", "new:", "updated for …".

**References.** RULE-STD-COMMENT-001, RULE-STD-COMMENT-005.

### RULE-STD-COMMENT-008 — No commented-out code, no TODO
**Scope.** both

**Rule.** Dead code is deleted, never commented out. Unfinished work is finished or removed, never parked in a comment marker.

**Why.** A marker is a deferral nobody tracks, and commented-out code is dead code.

**Prohibits.**
- Commented-out statements or blocks.
- `TODO`, `FIXME`, `HACK`, `XXX`, or a "temporary" / "for now" note about the code itself.

**References.** RULE-STD-ENG-009.

### RULE-STD-COMMENT-009 — Test names state behavior, with no tags
**Scope.** both

**Rule.** A test's name (`describe` / `it` / `test`) states the behavior it proves, and follows RULE-STD-COMMENT-002 through RULE-STD-COMMENT-006 like any comment.

**Why.** A test name is the first thing read when it fails; it has to say what broke.

**Prohibits.**
- `describe('[CODE_CHANGE_x] …')`, `it('FINDING 10: …')`, or any bracketed tag, ticket name, finding number, or phase label in a test name.

**References.** RULE-STD-COMMENT-004; RULE-STD-QUALITY-004 (one behavior per test).

### RULE-STD-COMMENT-010 — Only point at things that cannot drift
**Scope.** both

**Rule.** The only references a comment makes are to things that cannot drift: an engineering-rule ID (permanent, never renumbered), or a name in the code (a function, constant, type, or file).

**Why.** Documents are renamed, reorganized, and deleted; a pointer to one goes stale without anything noticing.

**Prohibits.**
- Pointers to any document or a section of one — design docs, playbooks, runbooks, plans, tracking docs, `CLAUDE.md` / `AGENTS.md`.

**References.** RULE-STD-COMMENT-003, RULE-STD-COMMENT-004, RULE-STD-COMMENT-011; [../README.md](../README.md) § Rule IDs (IDs are never renumbered).

### RULE-STD-COMMENT-011 — No links to outside sources
**Scope.** both

**Rule.** A comment carries no link or pointer to an outside source. What the reader needs from that source is stated in the comment itself.

**Why.** Outside pages move, change, and disappear, and nothing in the repo notices when they do.

**Prohibits.**
- Links to vendor documentation, articles, issue trackers, or forum answers (`https://firebase.google.com/docs/…`, a GitHub issue, a Stack Overflow answer).

**References.** RULE-STD-COMMENT-010.

### RULE-STD-COMMENT-012 — No comment describes a security mechanism
**Scope.** both

**Rule.** No comment explains how a security control works — authentication or authorization, provenance or trust between services, secrets and keys, rate limits and abuse defenses, detection and moderation, or the shape of a privileged path. Where such code needs a comment at all, it is a required marker or a one-line exception naming its rule; the mechanism is described only in the app's private design docs.

**Why.** A comment that explains a defense is a map for getting around it. In a public repository it publishes that map; in a private one it rots like any other comment.

**Prohibits.**
- A comment naming which check guards a route, what a token or cookie carries, where a secret or key lives, how a limiter keys or what it allows, or what a detector skips.

**References.** RULE-STD-ARCH-209 (everything in ttt-packages is public); RULE-STD-COMMENT-001.
