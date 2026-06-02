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
> `ttt-core` → `upload-ui` → `chat-react`. Run each touched package's build + tests. Where several
> ttt-core changes are listed, they can be batched into one publish.

---

## Publish/install GATE

Each item ships independently. After the package(s) for an item publish, the matching ttt-prod
adoption step (ttt-prod plan, B-gated) can run. **Never start the app adoption before its package
is published + installed.**

---

## A1. media-viewer — forward `autoPlayOnVisible` (package-only, LOW)

- **Why:** `VideoViewerProps.autoPlayOnVisible` exists but `MediaPreviewProps` doesn't expose it and
  `MediaViewer` doesn't forward it — a dead prop on the public API.
- **Change:** in `packages/media-viewer/src/types.ts` add `autoPlayOnVisible?: boolean` to
  `MediaPreviewProps`; in `packages/media-viewer/src/react/media-viewer.tsx` destructure it and pass
  it to `<VideoViewer>` in the video branch.
- **App adoption:** none required until a consumer opts in. Build + test media-viewer.

## A2. media-schemas — discriminate `MediaProcessingResultSchema` (LOW)

- **Why:** `packages/media-schemas/src/schemas.ts` (~L246-265) is a flat object with `ok: z.boolean()`
  and optional `error`, forcing `result.error!` non-null assertions in consumers.
- **Change:** convert to `z.discriminatedUnion('ok', [ {ok: z.literal(true), outputs: …},
  {ok: z.literal(false), error: MediaProcessingErrorSchema} ])`. Verify against the actual handlers
  whether the `ok:false` branch ever carries partial `outputs` (default: `ok:true` carries outputs,
  `ok:false` carries required `error`). Build + test media-schemas.
- **App adoption (B-gated G1):** delete `result.error!` / `(result as any)` workarounds; re-typecheck.

## A3. ttt-core — drop `GuildmateUser.displayName` (MEDIUM)

- **Why:** Display Identity Invariant violation — `GuildmateUser`
  (`packages/ttt-core/src/types/work-project.ts`) carries denormalized `displayName`. Reads already
  resolve via `publicUsers`; the field is write-only dead data.
- **Change:** remove `displayName` from the `GuildmateUser` type/schema. Build + test ttt-core.
- **App adoption (B-gated G2):** remove backend writes (`functions/src/shared/shareOperations.ts`
  ~L179, L268, L278 + any other writer), drop from seeds/factories, fix tests to join via publicUsers.
  No prod data scrub (pre-launch DB is wipeable — ASSUMED).

## A4. ttt-core — public guildmate membership mirror (MEDIUM)

- **Why:** signed-in non-members can't see ownership/collaborator attribution on public project/library
  views; member-gated `guildmateUsers` is the only source.
- **Change:** add a `PublicGuildmateUser` type (uid + role/`professions`/`tradeProfessions` for credit
  + `status`) and path builders for `allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}`
  (naming ASSUMED — confirm). Build + test ttt-core.
- **App adoption (B-gated G3):** public-read rule (`allow read: if request.auth != null; write: if false`),
  a mirror trigger on `guildmateUsers` changes, `useWorkProjectPublicGuildmates` hook + wiring, one-off
  backfill. On `status: 'departed'`: keep the public doc for alumni credit, mark status (ASSUMED — confirm).

## A5. file-input + ttt-core — audio + device capture for job applications (MEDIUM)

- **Why:** commission-proposal media spec rejects audio (`ACCEPT_IMAGE_VIDEO`, `allowRecordAudio:false`
  in `packages/ttt-core/src/media/ttt-media-specs.ts` ~L334-369); Tunes applicants can't submit audio demos.
- **Change (ttt-core):** add audio to the `commission-proposal` spec (`accept` audio, set duration cap,
  `allowRecordAudio:true`). **Change (file-input):** add a multi-source picker capability — pick existing
  file / take photo / record video / record audio — exposed so consumers can opt capture in per origin.
- **App adoption (B-gated G4):** wire the multi-source picker into the commission-proposal apply form
  (audio + capture on); `storage.rules` allows `audio/*` on the commission-proposal staging path;
  `processCommissionProposalMedia` handles audio end-to-end; audio player in application detail UI; e2e.
  Picker UX ASSUMED: "Select file" + "Take/Record" affordance, capture opt-in per FileOrigin — confirm.

## A6. ttt-core — input length caps in schemas (LOW/MEDIUM)

- **Why:** some schemas cap input (chat, hall library), others don't — inconsistent.
- **Change:** add `.max(...)` to user-input string fields across ttt-core schemas. Proposed starter cap
  table (ASSUMED — confirm values): displayName 50, username 30, bio 500, Streetz post 2000, commission
  listing title 120 / description 5000, commission proposal text 5000, audition text 2000, craft-skill
  name 60. Build + test ttt-core.
- **App adoption (B-gated G5):** surface the caps in forms (maxLength + counters); callables rely on the parse.

## A7. ttt-core — remove external profanity URLs (MEDIUM)

- **Why:** full self-owned profanity list — moderation must not track an external GitHub repo.
- **Change:** remove `WORD_LIST_URLS` (and any external-URL constant) from ttt-core. Build + test ttt-core.
- **App adoption (B-gated G6):** vendor a one-time snapshot of the current `_systemData/profanityList` as
  the baked-in seed; delete `functions/src/scheduled/runSyncProfanityList.ts` + the `syncProfanityList`
  export (`functions/src/index.ts`); rewrite `functions/src/utility/initProfanityList.ts` to seed from the
  vendored snapshot (no hardcoded GitHub URL); add an admin add/remove callable + audit events + a simple
  admin-area UI for curating `_systemData/profanityList`.

## A8. chat-schemas / chat-core — in-flight attachment placeholder (MEDIUM)

- **Why:** sending a chat attachment shows no in-flight feedback until processing completes.
- **Change:** add an "uploading"/pending state to the chat message schema (chat-schemas) and the
  send/merge logic in chat-core so a real placeholder message doc can exist in that state and be
  reconciled when processing finishes. Visibility rule: SENDER sees it across devices + on refresh;
  OTHER participants don't see it until terminal. Build + test the chat packages (chat-schemas before
  chat-core; chat-react if UI rendering changes).
- **App adoption (B-gated G7):** send path writes the placeholder via the callable; the media processor
  flips it to the final message on success (or removes/marks failed); reads filter the pending doc for
  non-senders; UI renders the pending bubble for the sender. (Coordinate with the upload pipeline.)

## A9. ttt-core — generic followable primitive + unify user-follows (CRITICAL feature)

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
- **App adoption (B-gated G8):** generic `followTarget`/`unfollowTarget` callables writing forward edge +
  reverse index + counter atomically (with audit); **migrate** existing `userFollows` to the unified model
  (clean cutover acceptable — pre-launch wipeable, ASSUMED); release-time follower notification fan-out via
  notification-core (Realm-follow → Realm releases, Work-follow → Work releases, deduped); generic hooks
  (`useFollowState`, `useToggleFollow`, follower counts) with long `staleTime` to limit reads; Follow/Unfollow
  UI on Work + Realm surfaces; rules for the follow edge + reverse index (callable-only writes). Keep
  `useFollowStatus` semantics.

## A10. ttt-core — per-origin upload registry-correctness tests (residual of CRITICAL)

- **Why:** representative real-upload e2e exists app-side; residual is table-driven correctness of
  `TTT_MEDIA_SPECS` / `FileOriginSchema` per origin.
- **Change:** add registry-correctness unit tests in ttt-core asserting each `FileOrigin` has a coherent
  spec (accept types, size/duration caps, path origin). Build + test ttt-core.
- **App adoption (B-gated G10):** keep app e2e importing the REAL `FileOriginSchema`; add representative
  per-mode coverage where launch-critical (confirm which origins). Can run in parallel.

## A11. ttt-core — trending index collection (paired with ttt-prod trending redesign B12)

- **Why:** move trending from a single top-5 snapshot to a paginated score-ordered index.
- **Change (recommended, CONFIRM):** add a `squareStreetzTrendingIndex` collection const + path builder to
  ttt-core (`{postId, score, computedAt}`), and document the required Firestore composite index
  (`score desc`). Build + test ttt-core.
- **Alternative (app-only, no package change):** keep the snapshot doc but store top-N=100 and paginate the
  array client-side — if chosen, A11 is dropped and the work is entirely in the ttt-prod plan.

---

## After publishing

Tell the user which package(s) to publish (dependency order). ttt-prod adoption (ttt-prod plan,
section B-gated) runs in a separate session against the installed versions.
