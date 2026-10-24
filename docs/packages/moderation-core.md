# @ttt-productions/moderation-core

Generic moderation adapter package.

## Owns

- Vision API adapter
- Video Intelligence adapter
- Generic result normalization
- Generic word-list text moderation/throw helpers where policy is injected

## Entry points

`.` (pure types + likelihood helpers), `./server` (API adapters).

- `.` — `Likelihood` union + `LIKELIHOOD_MAP`/`LIKELIHOOD_ORDER`/`likelihoodToString`/`isRejectionLikelihood(value, rejectionLikelihoods)`; result types `MediaModerationResult` — a checked result (`{ checked: true, safe, reason?, scores }`) or a check that did not complete (`{ checked: false, safe: false, reason, scores }`; `safe` stays `false` so a consumer that reads only `safe` still fails closed) — `TextModerationResult` (`{ safe, reason?, flaggedWords?, layer? }`).
- `./server` —
  - `moderateImage(imageSource, { rejectionLikelihoods, logger?, getClient? })` — Vision SafeSearch; GCS URI or HTTPS URL.
  - `moderateVideo(gcsUri, { rejectionLikelihoods, logger?, getClient? })` — Video Intelligence explicit-content; GCS only. An analysis error or an empty frame list is a check that did not complete (`checked: false`), never a flag, like an image SafeSearch returned no annotation for. A consumer maps it to its own retryable failure, not a content violation.
  - `moderateText(text, { wordList, minLength?, logger? })` — word filter (leet-speak-normalized); rejects with `layer: 'word_filter'` and the flagged words.
  - `quickWordFilter(text, wordList)`, `createWordListCache({ loader, ttlMs, logger? })` (TTL-memoized `WordListProvider` with `__reset`), plus test-only `__resetDefaultVisionClient`/`__resetDefaultVideoClient`.

## Boundary

The consuming app's wrappers own collection paths, word-list location, violation logging, storage relocation, rejection behavior, and user-facing copy.
