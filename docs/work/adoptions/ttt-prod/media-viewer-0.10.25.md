# Adopt @ttt-productions/media-viewer 0.10.25

**What:** The audio player saves its minimized state and mode only under a storage key the app hands in, through storage-core; its own default key is gone.
**Severity:** low

- **Package and version:** `@ttt-productions/media-viewer` 0.10.25.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:**
  - `AudioViewer` / `AudioPlayer`'s `persistKey` and `MediaPreview`'s `audioPersistKey` are
    `string` (no `null`) with no default. Without one, the player stores nothing: a choice lasts as
    long as the player is mounted. The default `'mv-audio-player'` is gone.
  - With a key, the player saves `<key>:minimized` and `<key>:mode` in local storage through
    storage-core's guarded functions, so a browser that blocks site data keeps the choice for the
    page's life (`docs/packages/media-viewer.md` § Canonical audio player).
  - `@ttt-productions/storage-core` is a new optional peer.
- **What the app must change:**
  - ttt-prod passes no key today, so its saved choice is stored under the package's default. It
    needs a storage key of its own for the audio player: a constant in ttt-core's
    `constants/storage-keys.ts` (in ttt-prod's own session). `'mv-audio-player'` keeps the choices
    browsers already saved.
  - Every render that can reach the audio player hands that key in, once, at ttt-prod's wrapper:
    `AppMediaPreview` (`src/components/shared/app-media-preview.tsx`) passes
    `audioPersistKey={<the key>}` to the package's `MediaPreview`, beside its `audioCrossOrigin`
    and before `{...props}`. That covers them all: the wrapper is the only module in `src` that
    renders the package's `MediaPreview`, and nothing in `src` renders `AudioViewer` or
    `AudioPlayer` directly (the one other import from `@ttt-productions/media-viewer/react`, in
    `full-hall-library-item-view.tsx`, is a type). So the fixed `type="audio"` renders
    (`full-hall-library-item-view.tsx`, `craft-skill-media-preview.tsx`,
    `commission-file-display.tsx`, `tune-track-media-upload-controls.tsx`) and the renders whose kind
    is decided at runtime and can be audio (`src/components/work-realm/realm-shared-files-section.tsx`
    `type={file.mediaKind}`, `src/components/work-realm/realm-file-steward-panel.tsx`
    `type={request.mediaKind}`, `src/app/take-it-down/page.tsx` `type={preview.mediaKind ?? 'image'}`,
    and anything passed through `expandable-media-preview.tsx` or `file-preview-dialog.tsx`) all get
    the key without a change at the call site. A search for `media-viewer/react` in `src` that finds
    a new render outside the wrapper is a render left without the key.
  - ttt-prod's RULE-STD-FRONTEND-010 addition lists the audio player's choice among its device-local
    state.
  - The install, with `@ttt-productions/storage-core` 0.0.2 or later among ttt-prod's dependencies.
- **Done when:** the lockfile names `@ttt-productions/media-viewer` 0.10.25 or later,
  `AppMediaPreview` hands ttt-prod's key to every `MediaPreview` it renders and is still the only
  render of the package's player in `src`, and the player's minimized state and mode survive a
  reload.
