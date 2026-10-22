import { createHash } from 'node:crypto';
import type { MediaAsset } from '../doc-schemas/media-assets.js';
import type { SafetyHoldResourceType } from '../doc-schemas/safety/foundation.js';

// Bumping it re-keys every hold.
const KEY_FORMAT = 'safetyHoldKey/v1';

// Cannot appear in a Firestore path, bucket name, key, uid, or channel id.
const SEP = '\x1f';

export interface ResourceKey {
  readonly resourceType: SafetyHoldResourceType;
  readonly resourceId: string;
  readonly canonicalResourceKey: string;
  readonly resourceKeyHash: string;
}

export function resourceKeyHash(canonicalResourceKey: string): string {
  return createHash('sha256').update(canonicalResourceKey, 'utf8').digest('hex');
}

function buildKey(
  resourceType: SafetyHoldResourceType,
  resourceId: string,
  ...parts: string[]
): ResourceKey {
  const canonicalResourceKey = [KEY_FORMAT, resourceType, ...parts].join(SEP);
  return {
    resourceType,
    resourceId,
    canonicalResourceKey,
    resourceKeyHash: resourceKeyHash(canonicalResourceKey),
  };
}

export function contentDocResourceKey(docPath: string, revision: string | number): ResourceKey {
  return buildKey('contentDoc', docPath, docPath, String(revision));
}

export function storageObjectResourceKey(
  bucket: string,
  key: string,
  generation: string | number,
): ResourceKey {
  return buildKey('storageObject', `${bucket}/${key}`, bucket, key, String(generation));
}

export function mediaAssetResourceKeys(
  asset: Pick<MediaAsset, 'mediaAssetId' | 'originLineage'>,
): ResourceKey[] {
  const keys: ResourceKey[] = [
    buildKey('mediaAsset', asset.mediaAssetId, 'asset', asset.mediaAssetId),
  ];
  const rootIngestId = asset.originLineage?.rootIngestId;
  if (rootIngestId) {
    keys.push(buildKey('mediaAsset', rootIngestId, 'rootIngest', rootIngestId));
  }
  return keys;
}

export function rootIngestResourceKey(rootIngestId: string): ResourceKey {
  return buildKey('mediaAsset', rootIngestId, 'rootIngest', rootIngestId);
}

export function chatMessageRangeResourceKey(
  channelId: string,
  messageSeqOrEpoch: string | number,
): ResourceKey {
  return buildKey(
    'chatMessageRange',
    `${channelId}#${messageSeqOrEpoch}`,
    channelId,
    String(messageSeqOrEpoch),
  );
}

export function channelResourceKey(channelId: string): ResourceKey {
  return buildKey('channel', channelId, channelId);
}

export function accountResourceKey(uid: string): ResourceKey {
  return buildKey('account', uid, uid);
}

export function safetyResourceCommandDocId(resourceKeyHash: string, commandId: string): string {
  return `${resourceKeyHash}__${commandId}`;
}
