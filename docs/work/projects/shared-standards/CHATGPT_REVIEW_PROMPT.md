# ChatGPT review prompt — shared-standards plan

Paste this into a fresh ChatGPT/Codex conversation:

```
This is a read-only review of a plan. Do not create, edit, move, or delete any file, and do not run
tests, builds, scripts, or anything that changes state. Read local files and run read-only searches
only. Never use git history, and never access hosted dev or production.

For this review I authorize read-only access to all three repos: C:\DjDev\ttt-master-app (ttt-prod),
C:\DjDev\q-sports-league (Q-Sports), and C:\DjDev\ttt-packages.

Read first:
- C:\DjDev\ttt-packages\docs\development-preferences.md (how an AI works with me; it applies to you)
- each repo's CLAUDE.md and its docs\engineering-rules\ (README, core-rules, every area file)

The plan and its data:
- C:\DjDev\ttt-packages\docs\work\projects\shared-standards\
  - PLAN.md — the plan (its last section lists the earlier review's findings and how each was
    handled; recheck each against the files)
  - merge-record.md — how every mixed shared rule is built
  - tables\ttt-prod-rule-ids.csv, tables\ttt-packages-rule-ids.csv — every rule: old ID -> new ID
    and its new file
  - tables\ttt-prod-paths.csv, tables\ttt-packages-paths.csv — old doc path -> new path
  - q-source\ — the Q-Sports texts the run uses
  - START_PROMPT.md — how the run conversation starts
- C:\DjDev\q-sports-league\docs\work\projects\migration-2.0\ttt-parity\rules-conversion\
  - q-sports-rule-ids.csv, q-sports-paths.csv — Q-Sports' tables
  - README.md — Q-Sports' conversion notes

The plan's "Decided" section is my decisions. Do not reopen them. Review everything else, and judge
whether this is the BEST way to carry out those decisions — not just whether its claims are true.

Check:
1. The rule sort. For every rule, open its text in each repo and confirm its kind is right: shared,
   app-only, same number but a different rule, or duplicate. Flag a rule marked shared that is really
   one product's business, an app rule that is really generic, a merge of two rules that are not
   the same rule, and any rule missing from a table or mapped twice.
2. The new IDs: one meaning per RULE-STD ID, the number bands followed, no clash.
3. The path tables: every doc that moves, stays, or becomes a pointer is right for its decision, and
   nothing the plan moves is missing.
4. The run: every agent group's owned files are disjoint from every other group that runs at the
   same time; every group names its tier and its mandatory reading; nothing a group needs comes from
   a group that runs after it; packages-first order holds (no app work before the release is
   installed); every step DJ must do is listed.
5. The public package: anything the plan would put in @ttt-productions/dev-standards (which is public
   on npm) that names an app's security internals.
6. Anything missing: a shared item with no step, a citation form the rewrite would miss (for
   example "ttt-packages ARCH-201", IDs inside guard-test titles, ESLint messages, firestore.rules
   comments), a test that will break, a doc that will still point at a deleted path.
7. Better ways: where a simpler or safer design reaches the same decisions, say so, with the
   trade-off.

Report in this chat only. For each finding: what is wrong, the evidence (file path and the rule ID
or row), why it matters, and your recommended fix. Order by severity. Then give one overall verdict:
is this plan ready to run as written, ready after the listed fixes, or not ready. Do not write the
report to a file.
```
