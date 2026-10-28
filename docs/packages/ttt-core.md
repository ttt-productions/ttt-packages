# @ttt-productions/ttt-core

TTT Productions' application-data package: the one home of every definition ttt-prod's frontend and
Cloud Functions both read.

This doc says what ttt-core owns and where each area's owner lives. The detail — every field,
constant, collection, and member — is the code; read the owner file named for an area. The
field-level view of every stored document is generated from the document registry into
[`docs/generated/firestore-schema.md`](../generated/firestore-schema.md).

## Owns

ttt-core holds TTT's business truth that crosses the client/server boundary — schemas, paths,
constants, copy, catalogs, and the pure rules over them — so the app never redefines a shape, list,
or rule locally. A new cross-boundary definition is added here first, released, then adopted by the
app (RULE-STD-ARCH-205). Each area below has one owner; consumers import it rather than restating it.

- **The document registry.** Every Firestore document TTT stores has one zod schema under
  `doc-schemas/` (by domain; the Trust & Safety and NCII documents under `doc-schemas/safety/` and
  `doc-schemas/ncii/`). `doc-schemas/registry` binds each collection path to its schema in
  `COLLECTION_SCHEMAS`; a package test fails a known collection that is neither bound nor explicitly
  deferred. `doc-schemas/erasure-fates` declares what an account erasure does to every registered
  path, and its test fails a registered path with no fate.
- **Wire schemas.** Callable inputs and results, upload target info, and other payloads that cross
  the wire live in `schemas/` by domain, beside each other, so the client and the callable parse the
  same shape.
- **Text fields.** Every text a person types is declared once in `constants/text-fields` as an
  `input-format-core` declaration; `schemas/text-field` (`textFieldSchema`) is the one zod schema
  for such a field, and `utils/text-field` is the one owner of its refusal and notice sentences. The
  form, the wire, and the writer read the same declaration, so they accept the same texts.
- **Paths and ids.** `paths/` owns collection and subcollection names, the path builders, collection
  references and groups, Storage paths, the related-id contracts, and the app's page routes
  (`APP_ROUTES` in `paths/app-routes`: one builder per app page a link, redirect, or notification
  reaches, with its query parameters; paths only — each runtime joins its own origin). Every route
  ttt-core names goes through `APP_ROUTES`. `paths/hall-browse` owns the Hall library's browse
  state, its query keys, and its parser; the admin views and the Backstage Guide topic ids a route
  takes are declared in `constants/`. Every persisted compound
  document id, the NCII durable case id included, is built — and, where read back, parsed — only by
  `paths/compound-ids`. TTT's
  realtime conversation kinds and the chat keys and ids derived from a conversation live in `ids/`.
- **Constants and limits.** `constants/` owns TTT's limits, business constants, option lists,
  labels, and product copy, one file per concern. `constants/app-mode` owns the app mode
  (`APP_MODE`), the per-mode limit sets, and `valueInMode` / `byMode`, through which every
  mode-varied value is read. `constants/release-flags` holds the code-level switches for features
  not yet live.
- **Permissions and capabilities.** `permissions/` owns the Work guild standings, the Work action
  catalog with each action's grant, and who may assign or remove each standing; consumers never keep
  their own standing maps or action matrices. `capabilities/` owns the capability registry and the
  messaging surfaces. UI affordances may read these catalogs; the app's backend is what enforces
  them.
- **Media contracts.** `media/` owns TTT's concrete `FileOrigin` set and its per-origin media specs
  (`ttt-media-specs`, built for an app mode), the start-upload request, upload target info (typed ids,
  never a client-supplied path or field map), the Hall-library target-field mappings, the pending-media
  schemas composed from `media-schemas`, the domain-event catalog, the media edge-serving contract,
  the fields every media-authority write sets with its version bump (`media-authority-co-write`), the
  root origin lineage an original upload's asset is stored with (`origin-lineage`), and publication
  arguments. `upload-variables/` owns each upload hook's variables schema.
- **Notifications.** `schemas/notification` owns the notification type catalog and the broadcast
  and archive inputs; `notifications/` owns `TTT_NOTIFICATION_CONFIG`, the one configuration TTT
  hands `notification-core`, derived from that catalog. Notification metadata carries ids, never a
  referenced record's title; `notifications/content-published-copy` owns the Hall-publication
  cards' title-free stored text and the copy the app renders from the titles it resolves.
- **Audit.** `types/audit` owns TTT's audit event type catalog and its actor and target
  specialization of the `audit-core` generic event.
- **Reports and the safety data model.** The documents and wire shapes of reports, report groups,
  Trust & Safety cases, holds, evidence, and take-it-down (NCII) requests live in
  `doc-schemas/safety/`, `doc-schemas/ncii/`, `schemas/safety`, and `schemas/ncii`; `report/` owns
  the TTT configuration values `report-core` is given. Runtime helpers over this model that need
  Node live in `safety/`, off the universal entries; the hashed ids of a take-it-down request's
  documents (its submissions, actions, case, validity decisions, and holds) are built only by
  `safety/ncii-intake-derivations`, and a report's canonical target key, id, and group key only by
  `safety/report-keys`.
- **Public documents and the legal-review notice.** The versioned public pages, their working
  copies, releases, and acceptance records live in `doc-schemas/public-documents`, with their
  version and acceptance rules in `utils/public-documents`; the notice's copy lives in
  `constants/legal-review-notice`, and whether it is shown and which revision of its copy is current
  in `constants/legal-review-notice-state`.
- **System slots.** `system-slots/` owns the registry of admin-managed slots (videos and accounts the
  app reads by id).
- **Business rules over this data.** Pure functions that state one TTT rule — eligibility,
  readiness, totals, access, reservation keys, age derivation — live in `utils/`, by concern, and
  both sides call them instead of re-deriving the answer. `utils/admin-tasks` builds the admin
  tasks a producer writes (content appeal, threshold review, admin dispatch) with the priority
  each task type gets, so the producer and every test fixture write the same document.
- **Shared types.** `types/` holds TypeScript types with no schema of their own.

## Boundary

- ttt-core belongs to ttt-prod and is governed as ttt-prod's code — by the apps-scoped shared rules
  and ttt-prod's rulebook (RULE-STD-ARCH-207).
- It may depend on generic packages; no generic package depends on it. Generic shapes stay in their
  generic owners: admin/report shapes in `report-core`, pure chat schemas in `chat-schemas`, text
  formats and their check in `input-format-core`, media shapes and factories in `media-schemas`,
  the notification mechanism in `notification-core`, the audit event in `audit-core`.
- It holds contracts, never enforcement: the app's backend enforces every rule these definitions
  describe.
- It is public (RULE-STD-ARCH-209). It never holds an app's security values or describes a security
  mechanism — secrets, keys, detection thresholds, guard arrangements, and privileged-path shapes
  live only in ttt-prod's private code and design docs.
- Every entry but `./safety` is universal: types, schemas, constants, unions, builders, and pure
  functions only, importable by Cloud Functions and the browser alike (RULE-STD-ARCH-202).

## Entry points

Each definition is exported by the entry of the folder that holds it (RULE-STD-ARCH-203);
`package.json` `exports` is the authoritative list.

- `.` — what no folder entry owns: `ids/`, `capabilities/`, `report/`, and `system-slots/`.
- `./doc-schemas` — the Firestore document schemas, the registry, and the erasure fates.
- `./schemas` — wire schemas, the text-field schema, and the notification type catalog.
- `./paths` — collection names, path builders, references, compound ids, and Storage paths.
- `./constants` — every constant catalog under `constants/`.
- `./permissions` — the guild-standing and Work-action catalogs and the assignment policy.
- `./media` — origins, media specs, upload and target-info contracts, and the domain-event catalog.
- `./upload-variables` — the upload hooks' variables schemas.
- `./notifications` — `TTT_NOTIFICATION_CONFIG`.
- `./utils` — the pure business-rule functions.
- `./types` — the shared TypeScript types, the audit types included.
- `./safety` — the Node-only Trust & Safety runtime helpers; the one runtime-specific entry, declared
  a Node exception in the boundary suite.
