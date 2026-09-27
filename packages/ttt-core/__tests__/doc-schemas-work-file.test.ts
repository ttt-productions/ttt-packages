// allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId} — a Work
// file renders by the kind the server inspected from its bytes, never by the client-declared MIME.

import { describe, it, expect } from 'vitest';
import { WorkFileSchema } from '../src/doc-schemas/work-project';
import { ContentMediaKindSchema } from '../src/doc-schemas/media-assets';
import { ConversationFileSchema } from '../src/doc-schemas/messaging';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

const workFile = {
  workFileId: 'file-1',
  workProjectId: 'work-1',
  workFileFolderId: 'folder-1',
  name: 'demo.mp4',
  mediaAssetId: 'asset-1',
  // A picker may declare the neutral type; only the inspected kind says what the file is.
  contentType: 'application/octet-stream',
  mediaKind: 'video' as const,
  sizeBytes: 1024,
  uploadedBy: { uid: 'uploader-1' },
  createdAt: 1_700_000_000_000,
};

describe('WorkFileSchema', () => {
  it('parses a Work file carrying its inspected media kind', () => {
    expect(WorkFileSchema.parse(workFile)).toEqual(workFile);
  });

  it('requires the inspected media kind — a file without it cannot be classified truthfully', () => {
    const { mediaKind: _mediaKind, ...withoutKind } = workFile;
    expect(WorkFileSchema.safeParse(withoutKind).success).toBe(false);
  });

  it('takes the kind from the one stored content-kind set, the same one Conversation Files use', () => {
    for (const mediaKind of ContentMediaKindSchema.options) {
      expect(WorkFileSchema.safeParse({ ...workFile, mediaKind }).success).toBe(true);
    }
    expect(WorkFileSchema.safeParse({ ...workFile, mediaKind: 'other' }).success).toBe(false);
    expect(WorkFileSchema.shape.mediaKind).toBe(ConversationFileSchema.shape.mediaKind);
  });

  it('is the registered schema for the workFiles path', () => {
    const entry = Object.entries(COLLECTION_SCHEMAS).find(([path]) => path.endsWith('/workFiles/{workFileId}'));
    expect(entry?.[1]).toBe(WorkFileSchema);
  });
});
