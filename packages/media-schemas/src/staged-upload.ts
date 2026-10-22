import { getSimplifiedMediaType, NEUTRAL_CONTENT_TYPE } from './helpers.js';
import type { MediaOriginSpec } from './types.js';

export interface VerifyStagedUploadOptions {
  allowNeutralContentType: boolean;
}

export type StagedUploadVerdict =
  | { ok: true; contentType: string; sizeBytes: number }
  | { ok: false; reason: 'unsupported-content-type'; contentType: string }
  | { ok: false; reason: 'unreadable-size'; size: unknown }
  | { ok: false; reason: 'too-large'; sizeBytes: number; maxBytes: number };

export function parseStorageObjectSize(size: unknown): number | undefined {
  if (size === undefined || size === null) return undefined;
  const text = String(size).trim();
  if (!/^\d+$/.test(text)) return undefined;
  const bytes = Number(text);
  return Number.isSafeInteger(bytes) ? bytes : undefined;
}

function contentTypeAccepted(contentType: string, spec: Pick<MediaOriginSpec, 'accept'>): boolean {
  const kinds: readonly string[] = spec.accept?.kinds ?? [];
  if (kinds.includes(getSimplifiedMediaType(contentType))) return true;
  if (!kinds.includes('file')) return false;
  return (spec.accept?.mimes ?? []).some((entry) =>
    entry.endsWith('/*') ? contentType.startsWith(entry.slice(0, -1)) : contentType === entry,
  );
}

export function verifyStagedUploadMetadata(
  metadata: { contentType?: unknown; size?: unknown },
  spec: Pick<MediaOriginSpec, 'accept' | 'maxBytes'>,
  options: VerifyStagedUploadOptions,
): StagedUploadVerdict {
  const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : '';
  const neutral = options.allowNeutralContentType && contentType === NEUTRAL_CONTENT_TYPE;
  if (!neutral && !contentTypeAccepted(contentType, spec)) {
    return { ok: false, reason: 'unsupported-content-type', contentType };
  }

  const sizeBytes = parseStorageObjectSize(metadata.size);
  if (sizeBytes === undefined) return { ok: false, reason: 'unreadable-size', size: metadata.size };
  if (spec.maxBytes !== undefined && sizeBytes > spec.maxBytes) {
    return { ok: false, reason: 'too-large', sizeBytes, maxBytes: spec.maxBytes };
  }
  return { ok: true, contentType, sizeBytes };
}
