# ttt-packages plan — backlog package changes for ttt-prod

> Source: ttt-prod backlog triage (`ttt-master-app/docs/code_changes_needed/`). This doc contains
> the **package-source** changes that must ship before the matching ttt-prod app adoption can run.
>
> **Workflow law:** edit + build + (user) publish each package HERE first. ttt-prod adoption is a
> SEPARATE later session against the just-published `node_modules/@ttt-productions/*` — see the
> "App adoption" lines (they live in the ttt-prod plan, section B-gated). Do NOT edit app code here.
> Do NOT bump versions or publish in app prompts. The user handles version bumps + publishing.
>
> Build/release order is the dependency topological order (see `CLAUDE.md`): Tier 0 → Tier 1 →
> `ttt-core` → `upload-ui` → `chat-react`. Run each touched package's build + tests.
>
> **Scope note:** several originally-considered package items (public guildmate mirror, file-picker
> audio/capture, input-length caps, displayName-denormalization, per-origin registry tests, trending
> index) were pulled back to `ttt-master-app/docs/code_changes_needed/still_needs_design_work/`
> pending design and are intentionally NOT in this plan.

---

## Publish/install GATE

Each item ships independently. After the package(s) for an item publish, the matching ttt-prod
adoption step (ttt-prod plan, B-gated) can run. **Never start the app adoption before its package
is published + installed.**

---

## A1. media-viewer — forward `autoPlayOnVisible` (package-only, LOW)

> ✅ **DONE** — implemented + built + tested (full package suite, 1855 tests green). **Publish `media-viewer`.** No app adoption needed.

- **Why:** `VideoViewerProps.autoPlayOnVisible` exists but `MediaPreviewProps` doesn't expose it and
  `MediaViewer` doesn't forward it — a dead prop on the public API.
- **Change:** in `packages/media-viewer/src/types.ts` add `autoPlayOnVisible?: boolean` to
  `MediaPreviewProps`; in `packages/media-viewer/src/react/media-viewer.tsx` destructure it and pass
  it to `<VideoViewer>` in the video branch.
- **App adoption:** none required until a consumer opts in. Build + test media-viewer.

## A2. media-schemas — discriminate `MediaProcessingResultSchema` (LOW)

> ✅ **DONE** — implemented + built + tested (1855 tests green). Required a co-change in **media-processing-core** (`src/processing/result.ts` helper signatures + `src/image/image-processor.ts` `MediaProcessingResult["error"]` → `MediaProcessingError`). **Publish `media-schemas` THEN `media-processing-core`.** App adoption = G1 (trivial; remove any `result.error!` after install).

- **Why:** `packages/media-schemas/src/schemas.ts` (~L246-265) is a flat object with `ok: z.boolean()`
  and optional `error`, forcing `result.error!` non-null assertions in consumers.
- **Change:** convert to `z.discriminatedUnion('ok', [ {ok: z.literal(true), outputs: …},
  {ok: z.literal(false), error: MediaProcessingErrorSchema} ])`. Verify against the actual handlers
  whether the `ok:false` branch ever carries partial `outputs` (default: `ok:true` carries outputs,
  `ok:false` carries required `error`). Build + test media-schemas.
- **App adoption (B-gated G1):** delete `result.error!` / `(result as any)` workarounds; re-typecheck.

## A3. ttt-core — remove external profanity URLs (MEDIUM)

- **Why:** full self-owned profanity list — moderation must not track an external GitHub repo.
- **Change:** remove `WORD_LIST_URLS` (and any external-URL constant) from ttt-core. Build + test ttt-core.
- **App adoption (B-gated G2):** vendor a one-time snapshot of the current `_systemData/profanityList` as
  the baked-in seed; delete `functions/src/scheduled/runSyncProfanityList.ts` + the `syncProfanityList`
  export (`functions/src/index.ts`); rewrite `functions/src/utility/initProfanityList.ts` to seed from the
  vendored snapshot (no hardcoded GitHub URL); add an admin add/remove callable + audit events + a simple
  admin-area UI for curating `_systemData/profanityList`.

## A4. chat-schemas / chat-core — in-flight attachment placeholder (MEDIUM)

- **Why:** sending a chat attachment shows no in-flight feedback until processing completes.
- **Change:** add an "uploading"/pending state to the chat message schema (chat-schemas) and the
  send/merge logic in chat-core so a real placeholder message doc can exist in that state and be
  reconciled when processing finishes. Visibility rule: SENDER sees it across devices + on refresh;
  OTHER participants don't see it until terminal. Build + test the chat packages (chat-schemas before
  chat-core; chat-react if UI rendering changes).
- **App adoption (B-gated G3):** send path writes the placeholder via the callable; the media processor
  flips it to the final message on success (or removes/marks failed); reads filter the pending doc for
  non-senders; UI renders the pending bubble for the sender. (Coordinate with the upload pipeline.)

## A5. ttt-core — generic followable primitive + unify user-follows (CRITICAL feature)

- **Why:** Work/Realm follow+notify is entirely unbuilt; the existing user-follow system is forward-only
  (`userProfiles/{uid}/userFollows/{targetUid}` + `followHistory`, callables `followUser`/`unfollowUser`,
  audit `social.userFollowed`) with NO reverse index, so release fan-out is impossible.
- **Change (ttt-core):**
  - `FollowableTargetType` union: `user | workProject | realm` (extensible).
  - Follow edge model `{followerUid, targetType, targetId, followedOn}` + path builders for the forward
    edge and a **reverse index** (target → followers) for fan-out, plus a denormalized follower-count
    location for cheap counts.
  - Input schemas `FollowTargetInput` / `UnfollowTargetInput` (replace the user-only ones, keeping `user`
    as one targetType). Add new audit event types to the `AuditEventType` union (e.g. `social.targetFollowed`).
  - Build + test ttt-core.
- **App adoption (B-gated G4):** generic `followTarget`/`unfollowTarget` callables writing forward edge +
  reverse index + counter atomically (with audit); **migrate** existing `userFollows` to the unified model
  (clean cutover acceptable — pre-launch wipeable); release-time follower notification fan-out via
  notification-core (Realm-follow → Realm releases, Work-follow → Work releases, deduped); generic hooks
  (`useFollowState`, `useToggleFollow`, follower counts) with long `staleTime` to limit reads; Follow/Unfollow
  UI on Work + Realm surfaces; rules for the follow edge + reverse index (callable-only writes). Keep
  `useFollowStatus` semantics. (Some sub-details — exact targetType naming, migration cutover, notification
  dedupe — to be confirmed during implementation.)

---

## After publishing

Tell the user which package(s) to publish (dependency order). ttt-prod adoption (ttt-prod plan,
section B-gated) runs in a separate session against the installed versions.
