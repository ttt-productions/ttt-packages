# A schema-typed seed for the in-memory Firestore store

**What:** The in-memory client store's `store.seed(path, data)` accepts any shape, so a test can seed a document its collection's schema rejects; a seed typed by the path builder's document type would stop it.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), while moving ttt-prod's `use-guild-invite-finalization` test onto the shared Firestore fake
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

`firebase-helpers`' in-memory store takes `store.seed(path, data: DocumentData)`. Nothing compares
`data` to the schema of the collection `path` points into, so a fixture can hold a value no real
writer and no schema allows. That is the fixture half of RULE-STD-QUALITY-012, and today only review
catches it. Seen in ttt-prod's `src/__tests__/hooks/use-guild-invite-finalization.test.tsx`: a
`recipientNote` field the invite schema strips (now removed), and status values the schema forbids.
The status values are kept on purpose under a RULE-STD-QUALITY-012 exception comment, because the
design requires the probe to refuse unrecognized statuses.

## Fix shape (not decided)

- **Package side (`firebase-helpers`):** a seed overload typed from a path builder's document type,
  so `store.seed(PATH_BUILDERS.guildInvite(id), …)` only accepts that document's shape. The path
  builders live in each app's data package, so the kit takes the type from the path value rather than
  from a map of app collections (RULE-STD-ARCH-201).
- **Guard side (repo-guards):** once the typed form exists, a check that fails a raw untyped
  `store.seed` outside a reviewed entry. A deliberate out-of-schema seed, like the guild-invite
  status cases, becomes a reviewed entry with its reason.

Both sides are packages-side and are adopted by each app.

## Done when

The typed seed ships in `firebase-helpers`, the guard is in repo-guards with its own tests, and each
app's raw seeds are typed or carry a reviewed entry DJ approved.
