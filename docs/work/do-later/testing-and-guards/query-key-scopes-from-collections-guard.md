# A guard that query-key scopes come from the collection constants

**What:** A repo-guards check that fails a query-key scope built from a hand-typed string where a
collection constant names that thing, and a non-collection scope whose name is not compound
camelCase.
**Severity:** low
**Trigger:** after launch, when DJ turns to improving the guards

This is a write-up of the item as it is known now, not a finished design.

## The gap

RULE-STD-FRONTEND-102 says a key scope is built from its collection constant or from a noun on the
app data package's declared-noun list (RULE-STD-ARCH-104). Nothing checks it: ttt-prod's `src/lib/query-keys.ts` hand-types every scope
(`createKeyScope('workProjects')`, `'social'`, `'account-deletion-request'`), where Q-Sports'
passes `COLLECTIONS.X` to `createKeyScope`.

## The shape

- Reads each app's `<QUERY_KEYS_MODULE>`; every `createKeyScope` argument is a collection constant,
  or a string literal that is compound camelCase and names no collection.
- Its reviewed exception is an entry in the app's guard config with its reason at the entry.
- RULE-STD-FRONTEND-102 names the guard and `playbooks/crosswalk.md` lists it, in the same release.

**Done when:** the guard runs green in ttt-packages and in both apps' suites.
