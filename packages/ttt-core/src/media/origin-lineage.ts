import type { MediaAssetOwnerType, MediaOriginLineageV1 } from '../doc-schemas/media-assets.js';

export interface RootOriginLineageInput {
  mediaAssetId: string;
  rootIngestId: string;
  originatingUploaderUid: string;
  originatingUploadEventId: string;
  originalUploadCreatedAt: number;
  rootSha256: string;
  currentOwnerType: MediaAssetOwnerType;
  currentOwnerId: string;
}

export function buildRootOriginLineage(input: RootOriginLineageInput): MediaOriginLineageV1 {
  const variantSha256s: MediaOriginLineageV1['variantSha256s'] = {};
  return {
    lineageVersion: 1,
    rootIngestId: input.rootIngestId,
    rootAssetId: input.mediaAssetId,
    originatingUploaderUid: input.originatingUploaderUid,
    originatingUploadEventId: input.originatingUploadEventId,
    originalUploadCreatedAt: input.originalUploadCreatedAt,
    rootSha256: input.rootSha256,
    variantSha256s,
    copyReason: 'original',
    currentOwnerType: input.currentOwnerType,
    currentOwnerId: input.currentOwnerId,
  };
}
