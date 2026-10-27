# A guard against label prefixes in test names

**What:** A repo-guards check that fails a test name (`describe` / `it` / `test`) that opens with an all-caps label and a colon (`CONCURRENT EDIT: …`, `FAIL-CLOSED: …`).
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), while working the HIGH review's test-name findings
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

RULE-STD-COMMENT-009 holds a test name to the comment rules, and RULE-STD-COMMENT-001 rules out a
label. ttt-prod had about 51 names in this shape across `src`, `functions/src`, and `e2e`
(`CONCURRENT EDIT:`, `PARITY:`, `TOCTOU:`, `HAPPY PATH:`, `SUCCESS:` / `FAILURE:` / `NO-OP:`, …).
They were rewritten as plain sentences by hand, and nothing stops the shape coming back.

## Fix shape

A generic repo-guards check over each test file's parse: a `describe` / `it` / `test` call (and their
`.each` / `.only` / `.skip` forms) whose first argument is a string or template literal opening with
an upper-case label and a colon fails. The exact pattern (how many letters, whether `/` `-` and
spaces may appear inside the label) is settled with its own must-fail and must-pass fixtures. ttt-
packages' boundary suite and each app's guard suite register it, and each app fixes what it flags in
the same adoption.

## Done when

The check is in repo-guards with its tests, every repo's guard suite registers it, and every name it
flags is a plain sentence.
