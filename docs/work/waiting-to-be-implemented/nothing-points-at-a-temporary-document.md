# Nothing in ttt-packages points at a temporary document

**What:** Every pointer at a temporary document comes out of ttt-packages' parked items, adoption files, package docs, design docs, `CLAUDE.md`, the shared docs in dev-standards, and code, as RULE-STD-QUALITY-206 requires.
**Severity:** medium

The rule (dev-standards 0.0.38) says: a temporary document is one deleted when its work is done — a
work item in any `docs/work/` folder, an adoption file, a raw finding, a project's plan and step
docs, a run or evidence folder, a scratch file. No document of any kind, and no code or code
comment, names one.

## The work

- Find every pointer with the second search of the codebase-hygiene playbook's step 27, run over the
  whole repo, and by reading: a file name written without its folder is a pointer too.
- Rewrite each one. It is never deleted blindly:
  - an adoption file that says "adopt together with that item", or names an app's item, says what
    the app must change and which package version must be installed;
  - a parked item that names another item, or an app's item, states the fact itself or says what
    must be true;
  - a path to a run or evidence folder becomes the evidence itself, quoted, or goes.
- The shared docs in dev-standards are read for the same thing: a line that names a place (a work
  folder, an adoptions folder) is not a pointer; a line that names a document in one is. A change
  there is a dev-standards release.

## Done when

Step 27's second search prints nothing in ttt-packages, a read of the work folders finds no item
or adoption file named by another, and `npm run test:quiet` is green.
