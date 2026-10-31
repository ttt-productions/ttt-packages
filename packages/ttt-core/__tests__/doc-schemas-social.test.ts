import { describe, it, expect } from 'vitest';
import {
  SquareStreetzPostSchema,
  SquareStreetzPostPayloadSchema,
  SquareStreetzPostTypeSchema,
  MediaTypeSchema,
  isTownCrierPostType,
} from '../src/doc-schemas/social.js';
import {
  LikeSquareStreetzPostResultSchema,
  UnlikeSquareStreetzPostResultSchema,
} from '../src/schemas/social.js';
import { townCrierPostDestination } from '../src/paths/town-crier-destination.js';
import { MAX_MENTIONS } from '../src/constants/business-content.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';

const textOnlyPost = {
  postId: 'p1',
  createdBy: { uid: 'u1' },
  authorId: 'u1',
  content: 'Hear ye!',
  relatedIds: ['user_u1'],
  createdAt: 1,
  likes: 0,
  postType: 'USER_POST' as const,
  hidden: false,
};

describe('SquareStreetzPostSchema — RULE-STD-MEDIA-101 media-pair invariant', () => {
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
    const result = SquareStreetzPostSchema.safeParse({
      ...mentionPost,
      content: '@m1 has joined the company!',
    });
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
    expect(SquareStreetzPostSchema.safeParse({ ...textOnlyPost, content, mentions }).success).toBe(
      false,
    );
  });

  it('the announcement transport takes post mentions only', () => {
    expect(
      SquareStreetzPostPayloadSchema.safeParse({
        userId: 'u1',
        mentions: [{ placeholder: '@m1', type: 'user', id: 'u1' }],
      }).success,
    ).toBe(true);
    expect(
      SquareStreetzPostPayloadSchema.safeParse({
        userId: 'u1',
        mentions: [{ placeholder: '@u1', type: 'user', id: 'u1' }],
      }).success,
    ).toBe(false);
  });
});

describe('a Square announcement payload stores no names', () => {
  it('the announcement payload keeps no Work, Realm, Hall item, or craft-skill name', () => {
    const parsed = SquareStreetzPostPayloadSchema.parse({
      userId: 'u1',
      workProjectId: 'wp1',
      workProjectTitle: 'A Work',
      workProjectDescription: 'About the Work',
      workRealmId: 'realm1',
      workRealmTitle: 'A Realm',
      hallItemId: 'hall1',
      hallItemTitle: 'A Hall item',
      craftSkill: { id: 'skill1', name: 'Guitar', mediaAssetId: 'asset1', type: 'video' },
    });
    expect(parsed).not.toHaveProperty('workProjectTitle');
    expect(parsed).not.toHaveProperty('workProjectDescription');
    expect(parsed).not.toHaveProperty('workRealmTitle');
    expect(parsed).not.toHaveProperty('hallItemTitle');
    expect(parsed.craftSkill).not.toHaveProperty('name');
  });

  it('the announcement payload says whether the Realm is public as a yes/no', () => {
    const payload = { userId: 'u1', workRealmId: 'realm1', workRealmIsPublic: true };
    expect(SquareStreetzPostPayloadSchema.parse(payload).workRealmIsPublic).toBe(true);
    expect(
      SquareStreetzPostPayloadSchema.safeParse({ ...payload, workRealmIsPublic: 'A Realm' })
        .success,
    ).toBe(false);
  });
});

const TOWN_CRIER_TYPES = SquareStreetzPostTypeSchema.options.filter((type) => type !== 'USER_POST');

const { createdBy: _createdBy, authorId: _authorId, ...authorlessPost } = textOnlyPost;

describe('Town Crier posts are system posts with no author', () => {
  it('only USER_POST is a member post; every other type is a Town Crier post', () => {
    expect(isTownCrierPostType('USER_POST')).toBe(false);
    for (const type of TOWN_CRIER_TYPES) expect(isTownCrierPostType(type)).toBe(true);
  });

  it.each(TOWN_CRIER_TYPES)('a %s post with no author is valid', (postType) => {
    expect(SquareStreetzPostSchema.safeParse({ ...authorlessPost, postType }).success).toBe(true);
  });

  it.each(TOWN_CRIER_TYPES)('a %s post carrying createdBy or authorId is refused', (postType) => {
    expect(
      SquareStreetzPostSchema.safeParse({ ...authorlessPost, postType, createdBy: { uid: 'u1' } })
        .success,
    ).toBe(false);
    expect(
      SquareStreetzPostSchema.safeParse({ ...authorlessPost, postType, authorId: 'u1' }).success,
    ).toBe(false);
  });

  it('a USER_POST without its author is refused', () => {
    expect(SquareStreetzPostSchema.safeParse(authorlessPost).success).toBe(false);
    expect(
      SquareStreetzPostSchema.safeParse({ ...authorlessPost, createdBy: { uid: 'u1' } }).success,
    ).toBe(false);
    expect(SquareStreetzPostSchema.safeParse({ ...authorlessPost, authorId: 'u1' }).success).toBe(
      false,
    );
  });

  it('a post with no postType is refused', () => {
    const { postType: _postType, ...untyped } = textOnlyPost;
    expect(SquareStreetzPostSchema.safeParse(untyped).success).toBe(false);
  });
});

describe('townCrierPostDestination links an announcement to the thing it announces', () => {
  it('an audition announcement opens the audition page', () => {
    expect(townCrierPostDestination({ postType: 'NEW_AUDITION', relatedAssetId: 'au1' })).toEqual({
      kind: 'audition',
      href: '/audition/au1',
    });
  });

  it('a commission announcement opens the commission page', () => {
    expect(townCrierPostDestination({ postType: 'NEW_COMMISSION', relatedAssetId: 'cl1' })).toEqual(
      { kind: 'commission', href: '/commission/cl1' },
    );
  });

  it('a publication announcement opens the Hall item', () => {
    expect(
      townCrierPostDestination({ postType: 'LIBRARY_PUBLISHED', relatedAssetId: 'hi1' }),
    ).toEqual({ kind: 'hallItem', href: '/hall-library/hi1' });
  });

  it.each(
    SquareStreetzPostTypeSchema.options.filter(
      (type) => !['NEW_AUDITION', 'NEW_COMMISSION', 'LIBRARY_PUBLISHED'].includes(type),
    ),
  )('a %s post links to nothing of its own', (postType) => {
    expect(townCrierPostDestination({ postType, relatedAssetId: 'x1' })).toBeNull();
  });

  it('an announcement without its asset id links to nothing', () => {
    expect(townCrierPostDestination({ postType: 'NEW_AUDITION' })).toBeNull();
  });
});

describe('a like on a Town Crier post answers no author', () => {
  const liked = { success: true, postId: 'p1', isLiked: true, likeCount: 1 } as const;
  const unliked = { success: true, postId: 'p1', isLiked: false, likeCount: 0 } as const;

  it('a like or unlike answer may omit authorId', () => {
    expect(LikeSquareStreetzPostResultSchema.safeParse(liked).success).toBe(true);
    expect(UnlikeSquareStreetzPostResultSchema.safeParse(unliked).success).toBe(true);
  });

  it("a member post's like answer still carries its author", () => {
    expect(LikeSquareStreetzPostResultSchema.parse({ ...liked, authorId: 'u1' }).authorId).toBe(
      'u1',
    );
  });
});
