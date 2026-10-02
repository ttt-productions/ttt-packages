import { describe, it, expect } from 'vitest';
import { SquareStreetzPostSchema, SquareStreetzPostPayloadSchema, MediaTypeSchema } from '../src/doc-schemas/social';
import { MAX_MENTIONS } from '../src/constants/business';
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

describe('a stored Square post holds its mentions to the post mention grammar', () => {
  const mentionPost = {
    ...textOnlyPost,
    content: '@m1 has joined the company of @m2!',
    mentions: [
      { placeholder: '@m1', type: 'user' as const, id: 'u1' },
      { placeholder: '@m2', type: 'workProject' as const, id: 'wp1' },
    ],
  };

  it('accepts a post whose text carries each mention placeholder once', () => {
    expect(SquareStreetzPostSchema.safeParse(mentionPost).success).toBe(true);
  });

  it('refuses a placeholder outside the @m grammar', () => {
    const result = SquareStreetzPostSchema.safeParse({
      ...mentionPost,
      content: 'Hi @alice',
      mentions: [{ placeholder: '@alice', type: 'user', id: 'u1' }],
    });
    expect(result.success).toBe(false);
  });

  it('refuses a mention its text does not carry, at that mention', () => {
    const result = SquareStreetzPostSchema.safeParse({ ...mentionPost, content: '@m1 has joined the company!' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('mentions.1.placeholder');
  });

  it('refuses more than MAX_MENTIONS mentions', () => {
    const mentions = Array.from({ length: MAX_MENTIONS + 1 }, (_v, i) => ({
      placeholder: `@m${i + 1}`,
      type: 'user' as const,
      id: `u${i}`,
    }));
    const content = mentions.map((m) => m.placeholder).join(' ');
    expect(SquareStreetzPostSchema.safeParse({ ...textOnlyPost, content, mentions }).success).toBe(false);
  });

  it('the announcement transport takes post mentions only', () => {
    expect(
      SquareStreetzPostPayloadSchema.safeParse({ userId: 'u1', mentions: [{ placeholder: '@m1', type: 'user', id: 'u1' }] })
        .success,
    ).toBe(true);
    expect(
      SquareStreetzPostPayloadSchema.safeParse({ userId: 'u1', mentions: [{ placeholder: '@u1', type: 'user', id: 'u1' }] })
        .success,
    ).toBe(false);
  });
});
