import { describe, it, expect } from 'vitest';
import {
  hash,
  channelKey,
  authPairKey,
  degradedCauseId,
  channelAuthEventId,
  accountAccessEventId,
  configEventId,
  attachmentFlipEventId,
  serverMessageEventId,
  serverMessageCommandId,
  chatSyncFanoutJobId,
  userWorkScopeKey,
  inboxProjectionEventId,
  notificationDeliveryId,
  notificationArchiveHistoryId,
  notificationArchivePayloadHash,
  moderationRequestedAuditId,
  moderationAppliedAuditId,
  moderationFailedAuditId,
  chatAnonymizeJobId,
  type ChannelRef,
} from '../src/ids/chat-ids';

const HEX64 = /^[0-9a-f]{64}$/;

describe('hash (canonical, frozen)', () => {
  it('is lowercase 64-char hex and deterministic', async () => {
    const a = await hash('tag', 'x', 1, null);
    expect(a).toMatch(HEX64);
    expect(await hash('tag', 'x', 1, null)).toBe(a);
  });

  it('separates parts so concatenation cannot collide', async () => {
    // ['ab','c'] vs ['a','bc'] must differ thanks to the 0x1F separator.
    expect(await hash('t', 'ab', 'c')).not.toBe(await hash('t', 'a', 'bc'));
  });

  it('distinguishes a null part from the empty string', async () => {
    expect(await hash('t', null)).not.toBe(await hash('t', ''));
  });

  it('different domain tags never collide for the same parts', async () => {
    expect(await hash('tagA', 'x')).not.toBe(await hash('tagB', 'x'));
  });

  it('encodes numbers base-10', async () => {
    expect(await hash('t', 5)).toBe(await hash('t', '5'));
  });
});

describe('channel identity', () => {
  const guild: ChannelRef = { scope: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' };
  const invite: ChannelRef = { scope: 'invite', guildInviteId: 'gi1' };

  it('channelKey is per-scope and matches the frozen formula', async () => {
    expect(await channelKey(guild)).toBe(await hash('chat-channel', 'wp1', 'ch1'));
    expect(await channelKey(invite)).toBe(await hash('chat-invite', 'gi1'));
  });

  it('guild and invite channel keys never collide', async () => {
    expect(await channelKey(guild)).not.toBe(await channelKey(invite));
  });

  it('authPairKey = hash(chat-channel-auth, channelKey, uid)', async () => {
    expect(await authPairKey(guild, 'u1')).toBe(await hash('chat-channel-auth', await channelKey(guild), 'u1'));
  });
});

describe('sync event + job ids match the frozen formulas', () => {
  it('chatSyncEvents eventIds', async () => {
    expect(await channelAuthEventId('ck', 'u1', 3)).toBe(await hash('channel-auth', 'ck', 'u1', 3));
    expect(await accountAccessEventId('u1', 2, 'ck')).toBe(await hash('account-access', 'u1', 2, 'ck'));
    expect(await configEventId('ck', 7)).toBe(await hash('config', 'ck', 7));
    expect(await attachmentFlipEventId('pm1', 'completed')).toBe(await hash('attachment-flip', 'pm1', 'completed'));
    expect(await serverMessageEventId('tr', 'src')).toBe(await hash('server-msg', 'tr', 'src'));
    expect(await serverMessageCommandId('tr', 'src')).toBe(await hash('server-msg', 'tr', 'src'));
  });

  it('fanout job + degraded ids', async () => {
    expect(await chatSyncFanoutJobId('workChannelsForUser', await userWorkScopeKey('u1', 'wp1'), 4)).toBe(
      await hash('chat-sync-fanout', 'workChannelsForUser', await userWorkScopeKey('u1', 'wp1'), 4),
    );
    expect(await degradedCauseId('syncEvent', 'e1')).not.toBe(await degradedCauseId('fanoutJob', 'e1'));
  });

  it('inbox projection eventId', async () => {
    expect(await inboxProjectionEventId('ck', 'u1', 'unread-set', 9)).toBe(
      await hash('chat-inbox-event', 'ck', 'u1', 'unread-set', 9),
    );
  });
});

describe('notification ids', () => {
  it('deliveryId uses the literal "shared" for shared-admin', async () => {
    expect(await notificationDeliveryId(null, 'content_report', 'rg1')).toBe(
      await hash('notif-delivery', 'shared', 'content_report', 'rg1'),
    );
    expect(await notificationDeliveryId('u1', 'guild_invite', 'gi1')).toBe(
      await hash('notif-delivery', 'u1', 'guild_invite', 'gi1'),
    );
  });

  it('archive id/payloadHash', async () => {
    expect(await notificationArchiveHistoryId('user', 'user:u1', 'req1')).toBe(
      await hash('notification-archive', 'user', 'user:u1', 'req1'),
    );
    expect(await notificationArchivePayloadHash('a', 'g', 'user', 'user:u1')).toBe(
      await hash('notification-archive-payload', 'a', 'g', 'user', 'user:u1'),
    );
  });
});

describe('moderation audit + anonymize ids', () => {
  it('moderation ids carry their distinguishing version part', async () => {
    expect(await moderationRequestedAuditId('r1')).toBe(await hash('chat-moderation-requested', 'r1'));
    expect(await moderationAppliedAuditId('r1', 2)).toBe(await hash('chat-moderation-applied', 'r1', 2));
    expect(await moderationFailedAuditId('r1', 1)).not.toBe(await moderationFailedAuditId('r1', 2));
  });

  it('anonymize jobId', async () => {
    expect(await chatAnonymizeJobId('do1', 5, 'u1')).toBe(await hash('chat-anonymize', 'do1', 5, 'u1'));
  });
});
