import { getSimplifiedMediaType, NEUTRAL_CONTENT_TYPE } from "./helpers.js";
import type { MediaOriginSpec } from "./types.js";

// Verifying a STAGED upload's real storage metadata against its origin spec — PURE.
//
// The client chose the content type and uploaded the bytes, so an upload-accept step
// must check what actually landed (the object's stored `contentType` and `size`), not
// what the client claimed. This is a fail-fast gate at accept time; byte inspection at
// processing (`inspectMedia`) stays the authority on what a file really is. The
// Admin-SDK metadata read lives in `@ttt-productions/media-processing-core/server`.

export interface VerifyStagedUploadOptions {
  /**
   * Accept a {@link NEUTRAL_CONTENT_TYPE} object for any origin. Enable it only when
   * processing inspects the bytes and terminally rejects what the origin does not
   * accept — it is the server half of upload-core's `allowNeutralContentType`.
   */
  allowNeutralContentType: boolean;
}

export type StagedUploadVerdict =
  | { ok: true; contentType: string; sizeBytes: number }
  | { ok: false; reason: "unsupported-content-type"; contentType: string }
  | { ok: false; reason: "unreadable-size"; size: unknown }
  | { ok: false; reason: "too-large"; sizeBytes: number; maxBytes: number };

/**
 * A storage object's byte size, as a storage metadata read or a storage event reports it
 * (a number, or a decimal string): a present, whole, non-negative, safe-integer byte count.
 * Anything else — absent, `NaN`, negative, fractional, beyond `Number.MAX_SAFE_INTEGER`,
 * or not a plain decimal — is `undefined`, never a guessed number.
 */
export function parseStorageObjectSize(size: unknown): number | undefined {
  if (size === undefined || size === null) return undefined;
  const text = String(size).trim();
  if (!/^\d+$/.test(text)) return undefined;
  const bytes = Number(text);
  return Number.isSafeInteger(bytes) ? bytes : undefined;
}

function contentTypeAccepted(contentType: string, spec: Pick<MediaOriginSpec, "accept">): boolean {
  const kinds: readonly string[] = spec.accept?.kinds ?? [];
  if (kinds.includes(getSimplifiedMediaType(contentType))) return true;
  if (!kinds.includes("file")) return false;
  return (spec.accept?.mimes ?? []).some((entry) =>
    entry.endsWith("/*") ? contentType.startsWith(entry.slice(0, -1)) : contentType === entry,
  );
}

/**
 * Check a staged object's stored metadata (`contentType`, `size` — as a storage
 * metadata read returns them) against its origin spec: the content type must be one of
 * the spec's accepted kinds (or, for a `file` kind, match an accepted MIME entry, `x/*`
 * wildcards included), and the size must be a present, readable byte count within
 * `maxBytes`. An absent or unreadable size fails closed.
 */
export function verifyStagedUploadMetadata(
  metadata: { contentType?: unknown; size?: unknown },
  spec: Pick<MediaOriginSpec, "accept" | "maxBytes">,
  options: VerifyStagedUploadOptions,
): StagedUploadVerdict {
  const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "";
  const neutral = options.allowNeutralContentType && contentType === NEUTRAL_CONTENT_TYPE;
  if (!neutral && !contentTypeAccepted(contentType, spec)) {
    return { ok: false, reason: "unsupported-content-type", contentType };
  }

  const sizeBytes = parseStorageObjectSize(metadata.size);
  if (sizeBytes === undefined) return { ok: false, reason: "unreadable-size", size: metadata.size };
  if (spec.maxBytes !== undefined && sizeBytes > spec.maxBytes) {
    return { ok: false, reason: "too-large", sizeBytes, maxBytes: spec.maxBytes };
  }
  return { ok: true, contentType, sizeBytes };
}
