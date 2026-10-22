export const TIMED_MEDIA_MAIN_OUTPUT_KEY = 'main' as const;

export const VIDEO_POSTER_OUTPUT_KEY = 'poster' as const;

export const IMAGE_DEFAULT_OUTPUT_KEY = 'original' as const;

export const MEDIA_PIPELINE_OUTPUT_KEYS = {
  video: [TIMED_MEDIA_MAIN_OUTPUT_KEY, VIDEO_POSTER_OUTPUT_KEY],
  audio: [TIMED_MEDIA_MAIN_OUTPUT_KEY],
} as const;

export type MediaPipelineOutputKey =
  | (typeof MEDIA_PIPELINE_OUTPUT_KEYS)[keyof typeof MEDIA_PIPELINE_OUTPUT_KEYS][number]
  | typeof IMAGE_DEFAULT_OUTPUT_KEY;
