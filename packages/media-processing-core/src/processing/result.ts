import type { MediaProcessingResult } from "@ttt-productions/media-contracts";

export function success(
  result: Omit<MediaProcessingResult, "ok">
): MediaProcessingResult {
  return { ok: true, ...result };
}

export function failure(
  error: MediaProcessingResult["error"]
): MediaProcessingResult {
  return {
    ok: false,
    mediaType: "other",
    error
  };
}
