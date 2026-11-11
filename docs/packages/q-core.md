# @ttt-productions/q-core

Q-Sports application-data package — Q-Sports' counterpart of `ttt-core`. It is governed by Q-Sports'
engineering rules (its own repo's `docs/engineering-rules/`), not this repo's (RULE-STD-ARCH-207); its
system model lives in Q-Sports' `docs/design/`.

## Owns

- Q-Sports' Firestore paths (`COLLECTIONS`, the subcollection maps, `PATH_BUILDERS`,
  `COLLECTION_REFS`, `toPath`) and compound and minted document ids, and `DECLARED_NOUNS`: the
  nouns a name may use for a thing with no collection of its own, each with its collections
- Every app page address, built through `APP_ROUTES` (`./paths`), and the custom-claim contract both
  roots parse the ID token against (`./types`)
- Q-Sports' types, unions, constants, and business copy
- Callable input schemas and the Firestore document-schema registry (`COLLECTION_SCHEMAS`)
- What Q-Sports hands `app-config-core`: `APP_CONFIG_DEFINITION` (`./utils`), its app config
  document's path bound to `AppConfigSchema`, through which every reader and writer of the document
  goes; with the standard maintenance sentence and `isMaintenanceOn`, the rule that the maintenance
  message alone decides maintenance
- What Q-Sports hands the shared sweep and account-repair mechanisms: its sweep names
  (`SWEEP_STATE_NAMES`), its registry binding of `sweep-core`'s `SweepStateSchema` for
  `sweepState/{sweepName}`, and the account-repair queue entry schema built with auth-core's
  `createAccountRepairQueueEntrySchemas` from its effects and statuses; an account repair is
  audited as `userProfile.authReconciled`
- The Q-Sports domain-event catalog and the admin-notification configuration
- The media origins and picture contracts, and the sport registry and adapters (stat events, scoring,
  bulk entry, columns)
- Every text a person types, declared once with its label in `constants/text-fields` as an
  `input-format-core` declaration; `schemas/text-field` (`textFieldSchema`) is the one zod schema for
  such a field, and `utils/text-field` is the one owner of its refusal and notice sentences
- The 2.0 migration console's manifest (each action's page ceiling and the sources its deletes
  consume), action ids, run state, and its lock and consumed-source predicates

## Entry points

`exports` in `package.json` is the authoritative list:

- `.` — what no folder entry owns: `migration-console/`
- `./types`, `./paths`, `./utils`, `./ids`, `./media`, `./domain-events` — typed surfaces by concern
- `./constants` — every constant catalog under `constants/`
- `./schemas` — callable input and wire schemas
- `./upload-variables` — the browser upload mutations' variables schemas, parsed first by each hook
- `./doc-schemas` — the whole-app Firestore document-schema registry (`COLLECTION_SCHEMAS`), the document
  atoms, and every document type
- `./sports` — the sport registry and adapters
- `./notifications` — the admin-notification configuration

## Boundary

`q-core` may depend on generic packages. Generic packages must not depend on `q-core`, and `q-core`
never depends on `ttt-core` — the two application-data packages never import each other.
