# @ttt-productions/app-config-core

Generic app config document: the one live settings document a product keeps (maintenance,
registration, an announcement, the deployed version, and whatever else it runs on). The document
must exist and hold every setting with a valid value; no setting has a default anywhere, and a save
writes only what really changed.

## Owns

- **The definition.** `defineAppConfig({ path, schema })` binds the product's document path to the
  schema of its settings, a plain zod object, and returns the product's `AppConfigDefinition`. The
  package holds no setting name: every setting is a key of the product's schema, and `settings` is
  that key list.
- **The strict read.** `definition.read(stored)` takes the stored document (`null` or `undefined`
  when it does not exist) and returns the settings alone, exactly as the schema reads them. It
  throws `AppConfigInvalidError` when the document is missing (`problem: 'missing-document'`), or
  when a setting is missing or holds a bad value (`problem: 'invalid-setting'`, `setting` naming
  it). The message is built from the product's path: `<path> does not exist.`, or
  `<path>.<setting> is missing or does not match its schema (…)`; a bad value inside a nested block
  names the setting, with the place inside it in the message. Nothing is filled in or repaired.
- **The merge.** `definition.merge(stored, update)` reads the stored document strictly (the same
  refusals), applies the settings the update sends (a setting left `undefined` is not sent), and
  returns `before`, `after`, and `changes`: only the settings whose value really differs. Values are
  compared by what they hold after the schema reads them, never by identity, so a nested block or a
  list sent again unchanged is no change, and text the schema trims back to its stored value is no
  change. An update whose result the schema refuses throws `AppConfigInvalidError` with
  `problem: 'invalid-update'` naming the setting, and nothing is returned to write.
- **The writer.** `writeAppConfig(writer, { ref, definition, stored, update })` merges the stored
  data the caller read in its own transaction, then calls `writer.update(ref, …)` once with exactly
  the changed settings, or not at all when nothing changed. `AppConfigWriter` is anything with that
  `update`; an Admin SDK transaction is one. It returns `updatedSettings` and, for each, its value
  `before` and `after`, which is what the caller's audit records. A missing or invalid stored
  document, or an update the schema refuses, throws before anything is written.

## Settings and other fields

The document may hold fields that are not settings. The read never looks at them and never refuses
a document for them; `before`, `after` and `changes` never hold one, even when the update carries
one; and the writer updates only changed settings, so it never sets, replaces or removes another
field.

## Entry points

- `.` — pure, zod only: `defineAppConfig`, `AppConfigDefinition`, `AppConfigMerge`,
  `AppConfigInvalidError` with its `AppConfigProblem`, and the setting and stored-data types.
- `./server` — `writeAppConfig`, over `firebase-helpers/server`'s Firestore contract, usable from
  TypeScript and from a plain `.mjs` script.

The page-side listener of the document is query-core's `createAppConfig` for now; the product
passes its definition's `read` to it.

## Boundary

The product supplies the document path and the schema of its settings, decides which writers may
save, and records the audit. The package names no product, path or setting (RULE-STD-ARCH-201),
captures nothing to monitoring (RULE-STD-QUALITY-102), reads no Firestore itself, and has no React
entry.
