import { now } from "@ttt-productions/firebase-helpers";
import type { MediaProcessingResult } from "@ttt-productions/media-contracts";

export function mapResultForFirestore(
  result: MediaProcessingResult
) {
  return {
    status: result.ok ? "ready" : "failed",
    result: result.ok ? result : null,
    error: result.ok ? null : result.error ?? null,
    updatedAt: now()
  };
}