# Media rules — upload & processing (MEDIA)

Format, scopes, and rule IDs: [../README.md](../README.md).

**This file is read in full whenever a task routes to media** — uploads, media processing, or a `pendingMedia` document. Read with the shared universal rules ([../core-rules.md](../core-rules.md)).

**The one topic file is conditional — read it only when the work touches its topic:**

- [serving-and-rendering.md](serving-and-rendering.md) (100s) — rendering or serving a stored file, or changing whether one is servable (hide, restore, quarantine, retire). An upload/processing-only change does not touch it.

The app's upload-pipeline design doc holds the system model; ttt-packages `docs/design/upload-path-invariant.md` holds the package side. Inspect the code as implementation truth (RULE-STD-ENG-001).

### RULE-STD-MEDIA-001 — One upload pipeline; fileOrigin ties the surface together
**Scope.** apps

**Rule.** Every media origin rides the one upload pipeline. `fileOrigin` is the single key binding a surface's local media spec (`<MEDIA_SPECS>`), staging path (`<UPLOAD_PATH_BUILDER>`), start-upload request field, target-info schema, and backend processor routing — the same value drives **all** of them, so a surface renders and submits one origin. Variants of one domain that the app registers as separate origins (its addition lists them) are **distinct** origins, never substituted. `<APP_NAME>` origin and domain naming stays in `<APP_DATA_PACKAGE>` and the app — never inside a generic upload package. An origin that does not ride the pipeline exists only as an exception the app's addition names, and the pipeline's entry points explicitly reject it.

**Why.** Rendering one origin's picker while submitting another desynchronizes UI and backend the moment a spec changes; a bespoke pipeline per "unusual" entry point is the duplication RULE-STD-ENG-003 prevents; an app's naming inside a generic package makes it that app's package.

**Prohibits.**
- Rendering one origin's picker while submitting another, even when their specs currently match.
- Substituting one registered variant for another, or building a parallel upload pipeline / helper / `pendingMedia` producer for a new surface.
- `<APP_NAME>` domain naming — an origin, a path, a spec — inside a generic upload package.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-003; RULE-STD-MEDIA-002, RULE-STD-MEDIA-006; RULE-STD-ARCH-201; ttt-packages `docs/design/upload-path-invariant.md`.

### RULE-STD-MEDIA-002 — Upload path invariant (LAW)
**Scope.** apps

**Rule.** Every uploaded file follows the one canonical staging path shape, `uploads/{fileOrigin}/{uid}/{pendingMediaDocId}`, built only by `<UPLOAD_PATH_BUILDER>(fileOrigin, uid, pendingMediaDocId)` in `<APP_DATA_PACKAGE>`.

- No extension on the path; the filename segment is the `pendingMedia` Firestore document id. No other segment — filename, entity id, or anything else — comes from the client.
- `fileOrigin` must **exactly** match a canonical value in `<FILE_ORIGIN_SCHEMA>` / `<MEDIA_SPECS>` — never infer casing or rename by style. Canonical origins may be mixed-style on purpose.
- `contentType` must be a concrete `image/*`, `video/*`, or `audio/*`, or EXACTLY the neutral `application/octet-stream` (the canonical-classification lane for unknown picker metadata — the server byte inspection decides what the file is; a client never fabricates a media MIME to pass this shape check). Any other type is rejected.
- The start-upload callable re-derives the pending id from the last path segment, rebuilds the expected path with `<UPLOAD_PATH_BUILDER>`, and rejects with `invalid-argument` unless the submitted path is **exactly equal** (`!==`) — a strict equality check, never a prefix match. Before it records anything, it checks the staged object's real Storage metadata (stored content type and size) against the origin's spec.

**Why.** One canonical staging shape is what lets the client, the rules, the callable, and the processors verify each other; any looseness — an extension, a prefix match, a style-guessed origin, a client-chosen segment, or trusting the declared type and size over the stored object — reopens the client-controlled-path hole this LAW closes.

**Defense in depth (layers that keep client, rule, and callable from drifting apart).** (1) `@ttt-productions/file-input` guarantees every emitted `File` has a valid contentType; (2) `@ttt-productions/upload-core` throws before any bytes hit Storage on a missing/invalid contentType; (3) the Storage rules enforce the path *shape*, a per-origin size cap (an unknown origin fails closed), and the contentType shape; (4) the start-upload callable enforces strict path **equality** and the stored-metadata check. `pendingMedia` is **callable-only** in the Firestore rules — it carries no path or `fileOrigin` enforcement there.

**Prohibits.**
- Building an upload path by hand, with an extension, with a client-chosen segment, or with a non-canonical/style-guessed origin.
- A prefix or "close enough" path check in place of strict equality; recording an upload without checking the stored object's metadata against the origin's spec.
- Enforcing the path or the `fileOrigin` allowlist in the Firestore rules (it is callable-only there).

**Change one part, change ALL of these in lockstep — there is no partial migration:** `<UPLOAD_PATH_BUILDER>` and the temp-path helpers, `<FILE_ORIGIN_SCHEMA>`, and `<MEDIA_SPECS>` (`<APP_DATA_PACKAGE>`); the start-upload path-equality check and per-origin auth switch; the processor routing; the Storage rules' origin allowlist, size caps, contentType shape, and path-shape match; the app's upload-pipeline design doc; and every upload mutation. The origin sync tests stay green.

**References.** RULE-STD-ENG-006; RULE-STD-MEDIA-004, RULE-STD-MEDIA-006; ttt-packages `docs/design/upload-path-invariant.md`.

### RULE-STD-MEDIA-003 — One guarded upload helper
**Scope.** both

**Rule.** Every upload-capable mutation hook routes its byte transfer through the single guarded helper `useGuardedUpload` in `@ttt-productions/upload-ui/react/upload`. The low-level resumable primitive (`uploadFileResumable` in `@ttt-productions/upload-core`) has **exactly one caller** — that helper — across both app code and packages.

**Why.** The helper owns phase reporting (`preparing → uploading` percent `→ finalizing`), guard register/unregister in try/finally, and `AbortSignal` wiring; calling the primitive directly skips all of it and produces a parallel upload experience.

**Prohibits.**
- Importing or calling `uploadFileResumable` anywhere but inside the guarded helper.
- A second upload helper or feature-level use of the low-level primitive.

**References.** RULE-STD-ENG-003; ttt-packages `docs/packages/upload-ui.md`, `docs/packages/upload-core.md`, `docs/design/upload-path-invariant.md`.

### RULE-STD-MEDIA-004 — Server derives targets; never trust client-supplied targets
**Scope.** apps

**Rule.** Processors and core functions never treat `targetDocPath`, `targetInfo`, or `targetFields` from a `pendingMedia` doc as authoritative for identity or target location. Identity fields (`createdBy`, `userId`, `actorId`, owner/admin) derive from `pendingMedia.userId`, `request.auth.uid`, or a privilege-checked context; target paths derive from the `<APP_DATA_PACKAGE>` path builders and asset-reference fields from server-side target-field maps. `targetInfo` may carry the domain payload and typed ids only; a legacy client identity field is ignored or exact-equality verified before any write. Processed derivatives, the fields that point at them, and every `*ProcessedAt` marker are written only by the backend.

**Why.** `targetInfo` is client-supplied; a processor that trusted a client path/target/owner would let a caller write into another user's documents, and a client that can write a processed field can point a record at bytes that were never processed.

**Prohibits.**
- Deriving a Firestore path or field map from client `targetInfo`.
- Writing a client-supplied `createdBy`/`userId`/owner field without exact-equality verification.
- A client write to a processed derivative, a field that points at one, or a `*ProcessedAt` marker.

**References.** RULE-STD-ARCH-104, RULE-STD-ARCH-106; RULE-STD-ENG-006; ttt-packages `docs/design/upload-path-invariant.md`.

### RULE-STD-MEDIA-005 — Upload hooks consume their variables schema
**Scope.** apps

**Rule.** Every upload-capable mutation hook types its variables as `z.infer<typeof XVariablesSchema>` from `<APP_DATA_PACKAGE>`'s upload-variables schemas and calls `XVariablesSchema.parse(variables)` first. Each hook owns its own variables type; file/no-file sub-variants use a per-hook discriminated union so a variant without a file has no `file` field.

**Why.** A restated variables interface drifts from the schema; parse-first makes illegal states unrepresentable at the client trust boundary (RULE-STD-ENG-005).

**Prohibits.**
- A local `interface XVariables` or a hook whose variables type is not `z.infer` of its schema.
- A shared cross-hook variables union; a `file` field at the canonical (non-variant) level.

**References.** RULE-STD-ENG-005.

### RULE-STD-MEDIA-006 — A new origin extends the registry, rules, routing, and tests in lockstep
**Scope.** apps

**Rule.** Adding a `FileOrigin` extends, in one change: `<FILE_ORIGIN_SCHEMA>` **and** `<MEDIA_SPECS>` (`<APP_DATA_PACKAGE>`); the Storage rules' origin allowlist, size cap, and contentType shape; the start-upload auth switch and its per-origin `targetInfo` schema; and the processor routing. The origin sync tests (every origin value maps to a processor kind) stay green; the processor `switch` is compile-time exhaustive, so an origin without a case fails the build via the `never` default.

**Why.** The origin allowlist, size caps, routing, and specs are one contract split across files; a half-added origin either fails closed silently or opens an unguarded path.

**Prohibits.**
- Adding an origin to `<FILE_ORIGIN_SCHEMA>` without its spec, rule cap, auth case, targetInfo schema, and processor route.
- Weakening/deleting the sync test to pass a partial addition, or adding an `<APP_NAME>` origin to a generic package (it belongs in `<APP_DATA_PACKAGE>`).

**References.** RULE-STD-MEDIA-001, RULE-STD-MEDIA-002; RULE-STD-ARCH-201.

### RULE-STD-MEDIA-007 — Pickers render local upload state only
**Scope.** apps

**Rule.** The local file UI renders **only** local phases (`selected`, `preparing`, `uploading`, `finalizing`, and local failure before backend processing). Backend `pendingMedia.status` (`pending`/`processing`) never feeds a picker's `isLoading`/`disabled` props. Backend visibility lives in the tray and the uploads page.

**Why.** The local handoff state is named `finalizing`, never `processing`; feeding backend status into the picker recreates the exact local/backend confusion the pipeline was built to eliminate.

**Prohibits.**
- Passing `pendingMedia.status === 'pending' | 'processing'` into a picker's `isLoading`/`disabled`.
- A feature-owned "Processing…" panel driven by `useUploadProcessing` (a cleanup adapter only) that competes with the tray.

**References.** RULE-STD-MEDIA-008; ttt-packages `docs/packages/upload-ui.md`.

### RULE-STD-MEDIA-008 — Upload UI ends at handoff; the tray owns processing
**Scope.** apps

**Rule.** A file-upload flow's interactive UI closes as soon as the handoff completes — bytes uploaded + `pendingMedia` created (the upload mutation resolving). It toasts that processing continues; the always-visible tray (and the uploads page) own backend status — never a reason to hold the user in the flow UI. Inline status slots ("processing…") are fine; a second general-purpose processing UI is not.

**Why.** The global in-flight layer already owns every outcome (tray progress, terminal toast, rejection dialog); a flow that holds itself open on processing duplicates that layer.

**Prohibits.**
- Holding a dialog open on `useUploadProcessing` instead of on the mutation's resolution.
- "Uploading…" copy persisting after the upload finished, or blocking a second action because a previous upload is still processing (absent a real domain cap).

**References.** RULE-STD-MEDIA-007; ttt-packages `docs/packages/upload-ui.md`.

### RULE-STD-MEDIA-009 — Cancellation and navigation guarding are package-owned
**Scope.** apps

**Rule.** Cancellation and navigation protection use the package-owned mechanisms — wired, never rebuilt: the `MediaInput` cancel + the consumer's `AbortSignal` threaded through the guarded helper; the `@ttt-productions/upload-ui/react/guard` provider (`beforeunload` + `confirmNavigation()`); and the guarded navigation entry points (`GuardedLink` / `useGuardedNavigation()`). The app's navigation helper (RULE-STD-FRONTEND-205) is the caller of `useGuardedNavigation()` — the guard provider is mounted once, in the root layout, around it — so app code navigates through the helper rather than calling the guarded entry points itself. Cancellation is local-upload only — shown during `preparing`/`uploading`, hidden thereafter; backend processing is intentionally not client-cancelable.

**Why.** Local byte upload is not durable — leaving mid-transfer ends it — so the warning must cover every abandon path (browser unload **and** in-app router navigation), owned in one place.

**Prohibits.**
- A hand-rolled `beforeunload`/navigation guard or cancel wiring in a feature.
- Reusing the `AbortSignal` machinery to try to cancel backend processing.

**References.** RULE-STD-FRONTEND-205, RULE-STD-FRONTEND-207; ttt-packages `docs/packages/upload-ui.md`.

### RULE-STD-MEDIA-010 — Upload-surface components own their full lifecycle
**Scope.** apps

**Rule.** An upload-surface component owns its complete local upload lifecycle inside a focused subcomponent; it never passes upload-state setters (`setUploadState`, progress setters) as props through unrelated components. Every deferred-upload form uses the one canonical deferred-form shell (owning the file-picker surface, `uploadState`/`onProgress` wiring, and focus) and calls its imperative `submit()` handle — the shell renders neither submit/cancel buttons nor a `<form>`.

**Why.** Threading upload-state setters through a component tree scatters one lifecycle across unrelated components and invites a second, drifting upload UI.

**Prohibits.**
- Passing upload-state setters as props into or out of unrelated components.
- A bespoke deferred-form file-picker surface instead of the canonical shell.

**References.** RULE-STD-MEDIA-003, RULE-STD-MEDIA-008.
