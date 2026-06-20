# @ttt-productions/moderation-core

Generic moderation adapter package.

## Owns

- Vision API adapter
- Video Intelligence adapter
- Generic result normalization
- Generic word-list text moderation/throw helpers where policy is injected

## Contract shape

Entry points: `.` (pure types + likelihood helpers), `./server` (API adapters).

- `.` — `Likelihood` union + `LIKELIHOOD_MAP`/`LIKELIHOOD_ORDER`/`likelihoodToString`/`isRejectionLikelihood(value, rejectionLikelihoods)`; result types `MediaModerationResult` (`{ safe, reason?, scores }`), `TextModerationResult` (`{ safe, reason?, flaggedWords?, layer? }`).
- `./server` —
  - `moderateImage(imageSource, { rejectionLikelihoods, logger?, getClient? })` — Vision SafeSearch; GCS URI or HTTPS URL.
  - `moderateVideo(gcsUri, { rejectionLikelihoods, logger?, getClient? })` — Video Intelligence explicit-content; GCS only.
  - `moderateText(text, { wordList, minLength?, logger? })` — word filter (leet-speak-normalized); rejects with `layer: 'word_filter'` and the flagged words.
  - `quickWordFilter(text, wordList)`, `createWordListCache({ loader, ttlMs, logger? })` (TTL-memoized `WordListProvider` with `__reset`), plus test-only `__resetDefaultVisionClient`/`__resetDefaultVideoClient`.

## Boundary

TTT wrappers own collection paths, word-list location, violation logging, storage relocation, rejection behavior, and user-facing copy.
