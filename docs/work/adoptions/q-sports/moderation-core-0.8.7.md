# Adopt @ttt-productions/moderation-core 0.8.7

**What:** `AnnotateVideoClient` is narrowed to the one call, in the one form, `moderateVideo` makes.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/moderation-core` 0.8.7.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers media-processing-core moderation-core monitoring-core notification-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** `AnnotateVideoClient` (`./server`) declares only `annotateVideo(request, { longrunning })` returning `Promise<[operation, ...unknown[]]>` — the single overload `moderateVideo` calls — instead of the vendor client's whole overloaded method. A `VideoIntelligenceServiceClient` still is one, so a real client passes unchanged. Behavior is unchanged.
- **What the app must change:** Install. A test client handed to `moderateVideo`'s `getClient` is typed against `AnnotateVideoClient` — a typed `annotateVideo` returning an `[operation]` tuple — with no cast.
- **Done when:** The lockfiles name 0.8.7 or later and the type check passes.
