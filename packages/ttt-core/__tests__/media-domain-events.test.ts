import { describe, it, expect } from 'vitest';
import {
  DomainEventSchema,
  ProfilePictureUpdatedEventSchema,
  SquareStreetzPostCreatedEventSchema,
  ChatAttachmentFinalizedEventSchema,
  ModerationViolationCreatedEventSchema,
} from '../src/media/domain-events.js';

describe('ProfilePictureUpdatedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'profile.pictureUpdated', ids: { userId: 'u_1' } };
    expect(ProfilePictureUpdatedEventSchema.parse(event).type).toBe('profile.pictureUpdated');
  });
  it('rejects missing userId', () => {
    expect(() => ProfilePictureUpdatedEventSchema.parse({ type: 'profile.pictureUpdated', ids: {} })).toThrow();
  });
});

describe('SquareStreetzPostCreatedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'squareStreetz.postCreated', ids: { userId: 'u_1', postId: 'p_1' } };
    expect(SquareStreetzPostCreatedEventSchema.parse(event).ids.postId).toBe('p_1');
  });
});

describe('ChatAttachmentFinalizedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'chat.attachmentFinalized', ids: { guildChatMessageId: 'm_1', conversationId: 'c_1' } };
    expect(ChatAttachmentFinalizedEventSchema.parse(event).ids.guildChatMessageId).toBe('m_1');
  });
});

describe('ModerationViolationCreatedEventSchema', () => {
  it('parses valid event with TTT fileOrigin', () => {
    const event = {
      type: 'moderation.violationCreated',
      ids: {
        userId: 'u_1',
        violationId: 'v_1',
        fileOrigin: 'profile-picture',
        pendingMediaId: 'pm_1',
      },
    };
    expect(ModerationViolationCreatedEventSchema.parse(event).ids.fileOrigin).toBe('profile-picture');
  });

  it('rejects unknown fileOrigin', () => {
    const event = {
      type: 'moderation.violationCreated',
      ids: {
        userId: 'u_1',
        violationId: 'v_1',
        fileOrigin: 'unknown-origin',
        pendingMediaId: 'pm_1',
      },
    };
    expect(() => ModerationViolationCreatedEventSchema.parse(event)).toThrow();
  });
});

describe('DomainEventSchema discriminated union', () => {
  it('accepts profile.pictureUpdated', () => {
    const result = DomainEventSchema.parse({ type: 'profile.pictureUpdated', ids: { userId: 'u_1' } });
    expect(result.type).toBe('profile.pictureUpdated');
  });

  it('accepts squareStreetz.postCreated', () => {
    const result = DomainEventSchema.parse({ type: 'squareStreetz.postCreated', ids: { userId: 'u_1', postId: 'p_1' } });
    expect(result.type).toBe('squareStreetz.postCreated');
  });

  it('rejects unknown event type', () => {
    expect(() => DomainEventSchema.parse({ type: 'bogus.event', ids: {} })).toThrow();
  });
});




describe('workRealm.coverUpdated (realm cover publication)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: { workRealmId: 'realm_1' } });
    expect(result.type).toBe('workRealm.coverUpdated');
  });

  it('rejects a missing workRealmId', () => {
    expect(() => DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: {} })).toThrow();
  });

  it('rejects unknown id fields (strict)', () => {
    expect(() =>
      DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: { workRealmId: 'realm_1', extra: 'x' } }),
    ).toThrow();
  });
});
