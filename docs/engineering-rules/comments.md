# Comment rules (COMMENT)

What a comment in ttt-packages may say, and what it may never say. Read in full for any task that
writes, edits, or reviews code — source, tests, scripts, and config — because every file carries
comments. A test name is held to these rules too (COMMENT-009). Format and IDs: [README.md](README.md).

**Existing code still carries comments that break these rules. They are fixed as files are touched,
never in a separate sweep:** any work that edits a file brings every comment and test name in that
file into line with these rules in the same change. An untouched file is never edited only to fix
its comments.

A comment these rules do not settle goes to DJ as a proposed new rule or edit. DJ decides; no work
makes, edits, or stretches a rule itself.

### COMMENT-001 — A comment says only what the code cannot

**Rule.** A comment is written only when it says something the code cannot say for itself: why the code is built this way (a constraint, trap, or trade-off a reader would not guess), a deliberate exception to a rule or pattern (naming the rule ID and the reason), or a warning about something important — a security boundary, money, safety, or data loss. It describes the code as it stands today and is as short as that explanation allows.

**Why.** Humans and agents read a comment as current truth; every sentence that is not needed is one more sentence that can go stale.

**Prohibits.**
- A comment with none of those three purposes.
- An exception to a rule that does not name the rule ID and the reason.
- One system-level explanation repeated file after file.

**References.** Every rule that REQUIRES a specific comment — each is a comment this rule keeps: ARCH-206 (the `SANCTIONED EXCEPTION` block), QUALITY-006 (the reasoned `eslint-disable-next-line`), QUALITY-007 (the guard allowlist justification). A rule that adds a required comment is added to this list in the same change. ENG-002 (no "keep in sync" comment pairs).

### COMMENT-002 — No dates

**Rule.** A comment carries no date of any kind. A date that is a VALUE the code depends on — an external API version string, a legal effective date — is data, not a comment date.

**Why.** A date is true only on the day it was written; after that the reader cannot tell whether the comment still holds.

**Prohibits.**
- Stamps and "as of" dates: `2026-07-10`, `July 2026`, `as of Q3`, `live 2026-07-31`, `fixed 2026-07-10`.

**References.** COMMENT-005 (history).

### COMMENT-003 — No line numbers

**Rule.** A comment never cites a line number. To point at code, it names the function, constant, type, or file.

**Why.** Line numbers move with every edit above them, so the reference goes wrong silently.

**Prohibits.**
- `route.ts:65`, `lines 678-681`, `~line 495`, "see line 12".

**References.** COMMENT-010 (references that cannot drift).

### COMMENT-004 — No ticket names or work labels

**Rule.** A comment carries no tracking-doc name, ticket ID, or work-plan label.

**Why.** Tracking docs are deleted when the work finishes, and the label then points at nothing.

**Prohibits.**
- `CODE_CHANGE_*` names; "Phase 6", "item 3", "FINDING 10", "Wave 2", "Batch 4", "P3", "[F16]", "§A7"; launch-plan step names; review-round tags.

**References.** COMMENT-009 (the same labels in test names), COMMENT-010.

### COMMENT-005 — No history

**Rule.** A comment describes what the code does and why, today. It never tells the story of how the code got this way.

**Why.** The history of the code lives in git; in a comment it is noise that goes stale.

**Prohibits.**
- "previously", "used to", "was changed to", "now uses", "fixed", "replaced the old X" — about the CODE. A comment about runtime state ("a profile that no longer exists") is not history.
- A regression test telling the incident; it states the failure it prevents.

**References.** COMMENT-002, COMMENT-007; QUALITY-001 (a fixed defect ships a regression test).

### COMMENT-006 — No people or review sources

**Rule.** A comment never names who decided, requested, reviewed, or found something. A decision is written as standing fact.

**Why.** Who decided is not the reason; the reason is what the reader needs.

**Prohibits.**
- "X ruling", "X-approved", "per the review", "the reviewer found", "the orchestrator".

**References.** COMMENT-001.

### COMMENT-007 — No narrating the obvious, no change notes

**Rule.** A comment never restates what the next line plainly does, and never records what an edit changed.

**Why.** The code already says what it does, and the diff is the record of what changed.

**Prohibits.**
- `// increment the count`, `// call the API`.
- "added X", "changed Y to Z", "new:", "updated for …".

**References.** COMMENT-001, COMMENT-005.

### COMMENT-008 — No commented-out code, no TODO

**Rule.** Dead code is deleted, never commented out. Unfinished work is finished or removed, never parked in a comment marker.

**Why.** A marker is a deferral nobody tracks, and commented-out code is dead code.

**Prohibits.**
- Commented-out statements or blocks.
- `TODO`, `FIXME`, `HACK`, `XXX`, or a "temporary" / "for now" note about the code itself.

**References.** ENG-009.

### COMMENT-009 — Test names state behavior, with no tags

**Rule.** A test's name (`describe` / `it` / `test`) states the behavior it proves, and follows COMMENT-002 through COMMENT-006 like any comment.

**Why.** A test name is the first thing read when it fails; it has to say what broke.

**Prohibits.**
- `describe('[CODE_CHANGE_x] …')`, `it('FINDING 10: …')`, or any bracketed tag, ticket name, finding number, or phase label in a test name.

**References.** COMMENT-004; QUALITY-001.

### COMMENT-010 — Only point at things that cannot drift

**Rule.** The only references a comment makes are to things that cannot drift: an engineering-rule ID (permanent, never renumbered), or a name in the code (a function, constant, type, or file).

**Why.** Documents are renamed, reorganized, and deleted; a pointer to one goes stale without anything noticing.

**Prohibits.**
- Pointers to any document or a section of one — design docs, playbooks, runbooks, plans, tracking docs, `CLAUDE.md` / `AGENTS.md`.


**References.** COMMENT-003, COMMENT-004, COMMENT-011; [README.md](README.md) § Rule IDs (IDs are never renumbered).

### COMMENT-011 — No links to outside sources

**Rule.** A comment carries no link or pointer to an outside source. What the reader needs from that source is stated in the comment itself.

**Why.** Outside pages move, change, and disappear, and nothing in the repo notices when they do.

**Prohibits.**
- Links to vendor documentation, articles, issue trackers, or forum answers (`https://firebase.google.com/docs/…`, a GitHub issue, a Stack Overflow answer).

**References.** COMMENT-010.
