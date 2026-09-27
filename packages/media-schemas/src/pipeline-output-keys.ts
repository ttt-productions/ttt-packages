// The output keys a media processing pipeline writes. A processed file is stored under its
// output key (media-processing-core names every output it persists from here), so a consumer
// that must know every object an ingest can leave behind — to clean it up, or to accept it as
// a variant name — derives that set from these declarations rather than restating the names.

/** The one transcoded output of a video or an audio file. */
export const TIMED_MEDIA_MAIN_OUTPUT_KEY = "main" as const;

/** A video's poster frame, written whenever the transcode produces one. */
export const VIDEO_POSTER_OUTPUT_KEY = "poster" as const;

/**
 * An image's single output when its processing spec declares no variants. An image spec that
 * declares variants is written under each variant's own `key` instead.
 */
export const IMAGE_DEFAULT_OUTPUT_KEY = "original" as const;

/**
 * Every output key the pipeline writes for timed media, by kind. Images are written under the
 * keys their spec declares (or `IMAGE_DEFAULT_OUTPUT_KEY`), so they have no fixed entry here.
 */
export const MEDIA_PIPELINE_OUTPUT_KEYS = {
  video: [TIMED_MEDIA_MAIN_OUTPUT_KEY, VIDEO_POSTER_OUTPUT_KEY],
  audio: [TIMED_MEDIA_MAIN_OUTPUT_KEY],
} as const;

export type MediaPipelineOutputKey =
  | (typeof MEDIA_PIPELINE_OUTPUT_KEYS)[keyof typeof MEDIA_PIPELINE_OUTPUT_KEYS][number]
  | typeof IMAGE_DEFAULT_OUTPUT_KEY;
