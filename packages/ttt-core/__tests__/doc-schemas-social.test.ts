import { describe, it, expect } from 'vitest';
import { SquareStreetzPostSchema, MediaTypeSchema } from '../src/doc-schemas/social';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

const textOnlyPost = {
  postId: 'p1',
  createdBy: { uid: 'u1' },
  authorId: 'u1',
  content: 'Hear ye!',
  relatedIds: ['user_u1'],
  createdAt: 1,
  likes: 0,
  hidden: false,
};

describe('SquareStreetzPostSchema — MEDIA-101 media-pair invariant', () => {
  it('accepts a text-only post (neither mediaAssetId nor mediaType)', () => {
    expect(SquareStreetzPostSchema.safeParse(textOnlyPost).success).toBe(true);
  });

  it('accepts a media post carrying BOTH mediaAssetId and mediaType', () => {
    for (const mediaType of MediaTypeSchema.options) {
      const result = SquareStreetzPostSchema.safeParse({
        ...textOnlyPost,
        mediaAssetId: 'asset-1',
        mediaType,
      });
      expect(result.success).toBe(true);
    }
  });

  // The bug this invariant closes: an extensionless gateway URL carries no kind, so a
  // post stored with an asset and no mediaType classifies as 'other' and renders a
  // Download link INSTEAD of the image/video.
  it('REJECTS a post with mediaAssetId and no mediaType', () => {
    const result = SquareStreetzPostSchema.safeParse({
      ...textOnlyPost,
      mediaAssetId: 'asset-1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('mediaType');
  });

  it('REJECTS a post with mediaAssetId and an explicitly undefined mediaType', () => {
    const result = SquareStreetzPostSchema.safeParse({
      ...textOnlyPost,
      mediaAssetId: 'asset-1',
      mediaType: undefined,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('mediaType');
  });

  it('REJECTS an orphan mediaType with no mediaAssetId', () => {
    const result = SquareStreetzPostSchema.safeParse({
      ...textOnlyPost,
      mediaType: 'video',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('mediaAssetId');
  });

  it('still rejects an unknown mediaType value', () => {
    const result = SquareStreetzPostSchema.safeParse({
      ...textOnlyPost,
      mediaAssetId: 'asset-1',
      mediaType: 'document',
    });
    expect(result.success).toBe(false);
  });

  it('is the schema the collection registry binds for the posts collection', () => {
    expect(COLLECTION_SCHEMAS['squareStreetzFeed/activePosts/socialPosts/{postId}']).toBe(
      SquareStreetzPostSchema,
    );
  });
});
