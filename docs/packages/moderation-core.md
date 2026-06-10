# @ttt-productions/moderation-core

Generic moderation adapter package.

## Owns

- Vision API adapter
- Video Intelligence adapter
- Perspective API adapter
- Generic result normalization
- Generic text moderation/throw helpers where policy is injected

## Contract shape

Entry points: `.` (pure types + likelihood helpers), `./server` (API adapters).

- `.` — `Likelihood` union + `LIKELIHOOD_MAP`/`LIKELIHOOD_ORDER`/`likelihoodToString`/`isRejectionLikelihood(value, rejectionLikelihoods)`; result types `MediaModerationResult` (`{ safe, reason?, scores }`), `TextModerationResult` (`{ safe, reason?, flaggedWords?, scores?, layer?, perspectiveStatus? }`), `PerspectiveScores`/`PerspectiveThresholds`.
- `./server` —
  - `moderateImage(imageSource, { rejectionLikelihoods, logger?, getClient? })` — Vision SafeSearch; GCS URI or HTTPS URL.
  - `moderateVideo(gcsUri, { rejectionLikelihoods, logger?, getClient? })` — Video Intelligence explicit-content; GCS only.
  - `moderateText(text, { wordList, perspective: { getApiKey, thresholds, fetchImpl? }, minLength?, logger? })` — layer 1 word filter (leet-speak-normalized) → layer 2 Perspective. **Perspective fails OPEN** (`safe: true` with `perspectiveStatus: 'error' | 'skipped_no_key'`) — callers needing fail-closed must check `perspectiveStatus`.
  - `quickWordFilter(text, wordList)`, `perspectiveCheck(text, opts)`, `createWordListCache({ loader, ttlMs, logger? })` (TTL-memoized `WordListProvider` with `__reset`), plus test-only `__resetDefaultVisionClient`/`__resetDefaultVideoClient`.

## Boundary

TTT wrappers own thresholds, collection paths, word-list location, violation logging, storage relocation, rejection behavior, and user-facing copy.
