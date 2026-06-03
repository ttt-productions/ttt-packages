import type { MediaProcessingError, MediaProcessingResult } from "@ttt-productions/media-schemas";

export function success(
  result: Omit<Extract<MediaProcessingResult, { ok: true }>, "ok">
): MediaProcessingResult {
  return { ok: true, ...result };
}

export function failure(
  error: MediaProcessingError
): MediaProcessingResult {
  return {
    ok: false,
    mediaType: "other",
    error,
  };
}
