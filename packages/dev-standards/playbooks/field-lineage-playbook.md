# Field Lineage Playbook

## Purpose

Audit where a given identity or owner field concept is stored and referenced across the app and the
packages it installs. Use it before changing how a user or owner id is stored, when verifying a rename
is fully applied, or to answer "where does this field live?" — one concept (a reference to a user)
appears under many field names, so a grep for one spelling misses the rest. It verifies
RULE-STD-ARCH-103 (persist identity references, not snapshots) against the code, and delegates the
authoritative document list to the `<APP_DATA_PACKAGE>` schema registry. Methodology only; the
per-step contract, boundary, and verdict are [README.md](README.md)'s.

It is NOT a rulebook and NOT a findings log. An app's locked rename targets (its terminology doc,
`<TERMINOLOGY_DOC>`) are audited in its additions.

**Boundary notes.** The field-lineage report is the repo-guards field-lineage tool behind the app's
thin script (the app's additions name the command): a local file walk that stops naming any folder or
file it cannot read, and never reports a partial walk as complete. A sibling `<PACKAGES_REPO>`
checkout may be absent; the report then says it was not scanned and its counts cover the app only.
This audit needs no emulators.

## When to run

Before changing how an identity or owner field is stored; when verifying a rename; before an
account-erasure audit (`data-integrity-playbook.md` step 13).

## Audit Steps

### 1. Run the field-lineage report
**Rules:** RULE-STD-ARCH-103. **Scope:** what the tool walks — every app source root, the scripts,
the end-to-end tree, every other deployed tree, `<PACKAGES_REPO>/packages` (tests included), and the
rules and index files.
**Expected:** the tool prints its alias count, a total reference count, and a file list sorted by hit
count. Use the user-reference alias set for the full "a reference to a user" concept (step 3), or any
raw field name. The run is the input to steps 2–4; a concept that returns hits under an unexpected
spelling is what this audit exists to surface. **The walk is the coverage claim, so confirm it still
covers every source root that holds identity fields** — scripts (migration runners included) and every
deployed tree that carries identity inside signed token claims; a root that holds identity fields and
is absent from the walk is a finding against this step, because every later step reasons over the
output as if it were the whole lineage.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Classify each hit
**Rules:** RULE-STD-ARCH-103. **Scope:** the step-1 output. **Method (semantic review).**
**Expected:** classify every hit as (a) an active current usage — expected; (b) a retired spelling in
code — a migration target; or (c) a retired spelling in docs — intentional where the terminology doc
records the rename, skip. Identity is stored as a uid reference, never a name or avatar snapshot; a
stored display-name or avatar field outside an audit-trail snapshot named as one is the
RULE-STD-ARCH-103 finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Check the user-reference alias set
**Rules:** RULE-STD-ARCH-103, RULE-STD-ARCH-104. **Scope:** the app and the packages.
```bash
# Coverage gate — identity-shaped schema fields the alias set cannot match. The schema folder
# and the alias-printing command are the app's (its additions name both).
comm -23 \
  <(rg -oNI "^\s{2,}([A-Za-z][A-Za-z0-9]*(Uid|UserId|OwnerId|ById)|ownerId)\s*:" "<APP_SCHEMA_DIR>" -g '*.ts' -g '!**/__tests__/**' -r '$1' | tr -d '\r' | sort -u) \
  <(<FIELD_LINEAGE> userRef | sed -n 's/^aliases: //p' | tr ',' '\n' | tr -d ' \r' | sort -u)
```
**Expected:** identity is stored as a uid reference; document-id fields use camelCase with an id
suffix (RULE-STD-ARCH-104). **The alias set is the audit's coverage boundary — the audit cannot see
what the set omits — so this comparison is the real check, and it prints nothing.** It lists every
identity-shaped field in the `<APP_DATA_PACKAGE>` document schemas that the alias set cannot match, so
the set is compared against the schema rather than a hand-kept list. A test inside the app's gate
should assert the same diff is empty, with a reasoned map for an identity-shaped name that is not a
user reference, so the gap cannot reopen silently. Note the word-boundary trap: an alias `closedBy`
does not match `closedByUid`. **This step is the precondition for `data-integrity-playbook.md` step
13**: an erasure scrub cannot be audited against an alias set that omits a field a collection stores.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Cross-check the schema registry
**Rules:** RULE-STD-ARCH-103, RULE-STD-ARCH-101. **Scope:** the `<APP_DATA_PACKAGE>` document schemas
in `<PACKAGES_REPO>`.
```bash
# Schema docs in sync — a ttt-packages script; the subshell keeps the caller's cwd.
(cd <PACKAGES_REPO> && npm run schema:check)
```
**Expected:** for every identity field on a stored document, the field name matches its
`<APP_DATA_PACKAGE>` schema, and RULE-STD-ARCH-103 governs which form of identity that document may
store. `schema:check` exits 0 (`schema docs are up to date.`); a `STALE:` line means the generated
docs need `npm run schema:docs` in ttt-packages. A stored identity field whose name diverges from its
schema, or a new user-reference field added without updating the registry, is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every hit is classified, every active field name
matches its schema, and step 3's coverage diff is empty. **FAIL** — a retired spelling remains in
production code past its scheduled rename, or a user-reference field exists on a stored document that
the alias set cannot match, so the audit is blind to it.
