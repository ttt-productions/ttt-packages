# Media rules — serving & rendering (MEDIA 100s)

Format, scopes, and rule IDs: [../README.md](../README.md).

Read with [core-rules.md](core-rules.md) whenever a task serves or renders a stored file, or changes whether one is servable (hide, restore, quarantine, retire). The app's serving and upload-pipeline design docs own the serving model and the render/recovery contract; inspect the code as implementation truth (RULE-STD-ENG-001).

### RULE-STD-MEDIA-101 — One media renderer
**Scope.** apps

**Rule.** Every stored/served file renders through the app's ONE media renderer — the app wrapper around `@ttt-productions/media-viewer`'s `MediaPreview` (the app's addition names it and what it adds) — covers, thumbnails, attachments, profile pictures, help videos, all of it. The display URL is built at render time by the canonical media URL builder (content docs store asset references, never URLs), never hand-built and never a raw upload path. Where a URL does not reveal its kind, every call site passes `type` (`'image'`/`'video'`/`'audio'`) or a `mime`/`name`, or the viewer classifies the URL as `"other"` and renders a Download-link fallback instead of the media. That classification comes from the server's inspection of the bytes (the asset's inspected media kind), never the client-declared MIME stored with the upload — a picker may declare the neutral `application/octet-stream` (RULE-STD-MEDIA-002), so a stored client MIME cannot say what a file is. A processed size that is missing renders the renderer's pending or failure state, never the original. Audio always renders through media-viewer's one canonical player, never the native `<audio>` bar. A live capture viewfinder (`getUserMedia`, not a served file) is outside this rule; any other exception is narrow, named in the app's addition, and still renders through the one renderer.

**Why.** A parallel display path silently skips the serving access the renderer carries, its recovery behavior, and the package's lazy-load/skeleton/memory-cleanup behavior; a hand-built URL or a raw upload path bypasses the serving path altogether, and falling back to the original serves bytes the processing step exists to replace.

**Prohibits.**
- `next/image` anywhere.
- A raw `<img>` / `<video>` / `<audio>` / `<source>` for a served file, or a CSS `background-image` pointed at a served file.
- A second render wrapper around a served file, or a call site that omits `type`/`mime`/`name` where the URL does not reveal its kind.
- A URL hand-built outside the canonical builder; a raw upload path as the display source; rendering the original when a processed size is missing.
- A render or routing decision (`contentType.startsWith('image/')`) taken from the client-declared MIME instead of the inspected media kind.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-003; RULE-STD-MEDIA-002, RULE-STD-MEDIA-004, RULE-STD-MEDIA-102; ttt-packages `docs/packages/media-viewer.md`.

### RULE-STD-MEDIA-102 — One IntersectionObserver per viewer
**Scope.** both

**Rule.** A media viewer owns at most one observer (one `useInView`) on its outer wrapper; when it needs multiple visibility thresholds it uses that one observer with a `threshold` array and derives each signal from `entry.intersectionRatio` / `entry`. Cross-package wrappers and app feature components own no observer around a nested viewer. Canonical: media-viewer's `video-viewer.tsx` — `useInView({ threshold: [0, 0.5] })`, where `0` drives lazy-load gating and `0.5` drives autoplay-on-visible from the same observer.

**Why.** A second observer per viewer (or a wrapper or feature building one around a nested viewer) multiplies observer churn and desyncs the lazy-load / autoplay / unload signals that must come from one source.

**Prohibits.**
- A second observer in a viewer, or observing the inner media element separately.
- A wrapper or feature component constructing an `IntersectionObserver` (or a second `useInView`) around a nested viewer.

**References.** ttt-packages `docs/packages/media-viewer.md`.

### RULE-STD-MEDIA-103 — A picture downloads only when shown, at the size it is drawn
**Scope.** both

**Rule.** A stored picture with several sizes starts its download only once its spot comes into view (a priority picture at once), and downloads the smallest stored size at least as wide as its spot is drawn, counting the screen's pixel density up to 2×; a spot later drawn wider moves up a size, never down. Both come from media-viewer's one mechanism (`MediaPreview`'s `sizes` and `onSizeWanted`, through the viewer's one observer, RULE-STD-MEDIA-102): an app never picks a size from a fixed display name and never measures or observes the spot itself. A downloaded file is held in memory only while something shows it; a revisit is the browser cache's to answer.

**Why.** A picture downloaded off screen, or at the largest size on a phone, spends the visitor's data and the page's load time on bytes nobody sees, and a download kept after nothing shows it holds memory for the whole visit.

**Prohibits.**
- A download started before its spot is in view, other than a priority picture's.
- A size chosen from a fixed name, or a size larger than the drawn width needs.
- A downloaded file kept in a cache after nothing shows it.
- A wrapper or feature measuring or observing a picture's spot itself.

**References.** RULE-STD-MEDIA-101, RULE-STD-MEDIA-102; RULE-STD-ENG-002; ttt-packages `docs/packages/media-viewer.md`.
