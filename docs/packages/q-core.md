# @ttt-productions/q-core

Q-Sports application-data package — Q-Sports' counterpart of `ttt-core`. It is governed by Q-Sports'
engineering rules (its own repo's `docs/engineering-rules/`), not this repo's (RULE-STD-ARCH-207); its
system model lives in Q-Sports' `docs/design/`.

## Owns

- Q-Sports' Firestore paths (`COLLECTIONS`, the subcollection maps, `PATH_BUILDERS`,
  `COLLECTION_REFS`, `toPath`) and compound and minted document ids
- Every app page address, built through `APP_ROUTES` (`./paths`), and the custom-claim contract both
  roots parse the ID token against (`./types`)
- Q-Sports' types, unions, constants, and business copy
- Callable input schemas and the Firestore document-schema registry (`COLLECTION_SCHEMAS`)
- The Q-Sports domain-event catalog and the admin-notification configuration
- The media origins and picture contracts, and the sport registry and adapters (stat events, scoring,
  bulk entry, columns)
- The 2.0 migration console's manifest, action ids, and run state

## Entry points

`exports` in `package.json` is the authoritative list:

- `.` — what no folder entry owns: `input-formats/` and `migration-console/`
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
