# Adopt @ttt-productions/dev-standards 0.0.26

**What:** destructive actions move into the one "…" menu; one upload path for every origin; RULE-STD-BACKEND-212 is deleted; derived values and App Check token consumption join their shared rules; `<CALLABLE_DECLARATIONS>` names modules.
**Severity:** medium
**Came from:** the Q-Sports rulebook-on-shared-rules ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.26. Adopt `dev-standards-0.0.21.md`
  to `dev-standards-0.0.25.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.

## What changed

- **RULE-STD-FRONTEND-006** (retitled "…destructive actions live in the one '…' menu…"): every
  destructive action on an item — delete, remove, close, hide, and the like — lives in the app's one
  shared "…" actions menu and opens its confirmation dialog from there, never inline on the item; the
  item's secondary actions (a download, a report) sit in the same menu; red is only the dialog's
  confirm and urgency text; admin actions stay in the admin actions. The "where a destructive trigger
  must sit inline it renders neutral" clause is gone.
- **RULE-STD-MEDIA-002** (retitled "One upload path (LAW)"): every uploaded file goes through the one
  staging path, check and `pendingMedia` record. Each origin's spec carries two settings — processed
  or kept as given, signed in or signed out allowed. A signed-out upload uses the same path with one
  fixed signed-out owner segment (never a real user id), create-only, no client read/overwrite/delete,
  claimed by its unguessable pending id, its bytes read by the server before use, and swept when never
  used. The browser (`file-input`) and the start-upload check test each file's content type against
  its origin's spec; the Storage rules check only the shared outer shape. A side path for one kind of
  file is prohibited; there is no app exception. RULE-STD-MEDIA-001 loses "an origin that does not
  ride the pipeline exists only as an exception the app's addition names"; RULE-STD-MEDIA-006's
  routing reads "a processor for a processed origin, the kept-as-given handling for one kept as
  given". The firestore-storage-rules (step 9), media-pipeline (steps 1, 2, 4) and
  client-write-security-audit (step 7) playbook steps follow; the crosswalk carries the new title.
- **RULE-STD-BACKEND-212 is deleted** (repair actions no longer require a typed reason or a before/after
  record). Its references are gone from RULE-STD-FRONTEND-202 (the dialog no longer gathers a repair
  reason), RULE-STD-BACKEND-114's references, codebase-hygiene step 65 and the crosswalk.
- **RULE-STD-BACKEND-201** gains: a total, count, or other value the server derives is computed by the
  server from its source, and a callable never stores one the client sent; data an admin enters as
  source is allowed.
- **RULE-STD-BACKEND-010** gains token consumption: a sensitive (admin) callable consumes a single-use
  App Check token (`consumeAppCheckToken: true`, a limited-use token from its client declaration); an
  exemption carries its reason in the app's guard config; the repo-guards `appCheck` guard enforces it.
- **`<CALLABLE_DECLARATIONS>`** (`claude/CLAUDE.base.md`) now means the modules that declare every
  callable the client invokes, named the same in the guard config.

## What the app must change

- Install.
- `CLAUDE.md`: the `<CALLABLE_DECLARATIONS>` value becomes `src/lib/callables.ts`,
  `src/lib/admin-callables.ts` (both already in `src/__tests__/guards/config/callables.ts`).
- `docs/engineering-rules/media/core-rules.md`: the RULE-STD-MEDIA-001 "one non-pipeline origin" line
  and the RULE-STD-MEDIA-002 "Sole exception — `ncii-evidence`" bullet go; the additions say the
  take-it-down evidence moves onto the one path as a signed-out origin
  (`docs/work/waiting-to-be-implemented/take-it-down-one-signed-out-upload-place.md`, which also owns
  the code: `nciiEvidence/…`, `nciiAuthorityEvidence/…` and their own content types in
  `storage.rules`). The `storage.rules` "contentType regex" wording follows the outer shape.
- RULE-STD-BACKEND-212: the package session found no citation of it in ttt-prod's rulebook,
  playbooks or design docs. Confirm none, and that no typed reason box exists only for it (an admin's
  decision reason, such as a suspension's or a refund denial's, belongs to RULE-STD-BACKEND-203 and
  stays).
- RULE-STD-BACKEND-010: ttt-prod's `appCheck` guard config consumes in its admin, payments and safety
  folders with no exemption; confirm it satisfies the rule as written.
- RULE-STD-FRONTEND-006: moving ttt-prod's inline destructive triggers into the menu is its own item
  (`docs/work/waiting-to-be-implemented/destructive-actions-into-the-shared-menu.md`), after
  ttt-packages' `shared-item-actions-menu.md` ships the shared menu.

**Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.26 or later, the `CLAUDE.md`
value and the media additions say the above, and the two checks are confirmed.
