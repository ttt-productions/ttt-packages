# Adopt @ttt-productions/ttt-core 0.79.115

**What:** A curated creator option uploads as its own origin, with no entry agreement.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (found during group H's adoption)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.115.
- **Release:** `./scripts/release-multiple.sh ttt-core patch`.
- **What changed:**
  - New `FileOrigin` `audition-curated-option`. Its target info is `AuditionCuratedOptionTargetInfoSchema` (`{ auditionId }`, strict, no agreement version).
  - The new origin is in `ADULT_ONLY_UPLOAD_ORIGINS` and `fileOriginRowLabel` ("Audition option").
  - In `TTT_MEDIA_SPECS`, `audition-entry` and `audition-curated-option` share one spec object.
  - `AuditionMediaPublicationArgsSchema` gains a `curatedOption` mode (`userId`, `auditionId`, `auditionEntryId`, `submittedAt`) beside the `entry` mode. The `entry` mode still requires `agreementVersion`.
  - `AuditionEntrySchema` is exact: an entry with `isCreatorOption: true` carries no `agreementVersion`, and every other entry requires one.
  - `audition-entry` is unchanged: its target info still requires the current entry agreement version.
- **What the app must change:** Install `@ttt-productions/ttt-core@latest` wherever it is declared, then carry the new origin through every place the media rules' lockstep set names:
  - `resolveProcessorKind`: the new origin routes to `audition`.
  - `storage.rules`: `uploadMaxBytes` gets the same cap as `audition-entry`.
  - `stale-pending-media-age.ts` lists the new origin.
  - Both upload callables' per-origin switches: `startUpload` and `adminStartUpload` accept the new origin through one shared ownership check (the caller's own curated audition, or the caller's own in-flight curated prompt). `adminStartUpload` stops accepting `audition-entry`.
  - `start-upload-core.ts` runs its community-entry checks for `audition-entry` only.
  - `processAuditionMedia`: each origin builds its own args (`entry` with the ticked version, `curatedOption` with the upload's pending id). There is no identity guess.
  - The audition adapter passes the kind to `runCreateAuditionEntry`. That core checks the kind against the audition: a curated option needs a curated audition the caller created, and a community entry needs a non-curated one. It stores `agreementVersion` only on a community entry.
  - The curated create flow (`uploadCuratedOptionEntries`, `curated-options-picker.tsx`) uploads on the new origin.
  - `in-flight-uploads-adapter.tsx` gets its copy for the new origin.
  - The origin sync tests and the upload, processor, adapter, core and hook tests cover both kinds.
  - `upload-and-media-pipeline.md` and `audition-system.md` describe the two origins.
- **Done when:**
  - The lockfiles name `@ttt-productions/ttt-core` 0.79.115 or later.
  - A curated audition's option videos upload and publish with no agreement version.
  - A community entry still stores the version its entrant ticked.
  - The gate is green.
