import { describe, it, expect } from 'vitest';
import {
  canAccessGuildChatChannel,
  canAccessGuildInviteConversation,
  canCancelGuildInvite,
  guildInvitePartyOf,
  isGuildInviteConversationLive,
  GUILD_INVITE_CONVERSATION_LIVE_STATUSES,
  type GuildChatAccessMember,
} from '../src/utils/guild-chat-access';
import { FOUNDING_WORK_HOLDER_TYPE } from '../src/doc-schemas/work-project';

const member = (over: Partial<GuildChatAccessMember> = {}): GuildChatAccessMember => ({
  status: 'active',
  guildStandings: [],
  tradeProfessions: [],
  ...over,
});

describe('one guild chat channel rule: standings OR trades', () => {
  const writersOnly = { requiredGuildStandings: ['HallLibraryEditor'] };

  it('admits a member who holds a required standing', () => {
    expect(canAccessGuildChatChannel(member({ guildStandings: ['HallLibraryEditor'] }), writersOnly)).toBe(true);
  });

  it('admits a trade-only member — a matching trade profession is enough', () => {
    expect(canAccessGuildChatChannel(member({ tradeProfessions: ['HallLibraryEditor'] }), writersOnly)).toBe(true);
  });

  it('refuses a member with neither', () => {
    expect(canAccessGuildChatChannel(member({ guildStandings: ['CommissionManager'], tradeProfessions: ['Artist'] }), writersOnly)).toBe(false);
  });

  it('an open channel (no requirement) admits every active guildmate', () => {
    expect(canAccessGuildChatChannel(member(), { requiredGuildStandings: [] })).toBe(true);
  });

  it('never admits a departed member, the founding-Work stake holder, or no member', () => {
    const open = { requiredGuildStandings: [] };
    expect(canAccessGuildChatChannel(member({ status: 'departed' }), open)).toBe(false);
    expect(canAccessGuildChatChannel(member({ holderType: FOUNDING_WORK_HOLDER_TYPE }), open)).toBe(false);
    expect(canAccessGuildChatChannel(null, open)).toBe(false);
  });

  it('a deleted or missing channel admits nobody', () => {
    expect(
      canAccessGuildChatChannel(member({ guildStandings: ['StewardOwner'] }), { requiredGuildStandings: [], isDeleted: true }),
    ).toBe(false);
    expect(canAccessGuildChatChannel(member(), null)).toBe(false);
  });
});

describe('one invite rule: the recipient, and the Work side — the sender and the invite handlers', () => {
  const invite = { senderUid: 'sender', recipientUid: 'recipient' };

  it('the recipient takes part as the recipient, with no guildmate record', () => {
    expect(guildInvitePartyOf({ ...invite, uid: 'recipient', member: null })).toBe('recipient');
  });

  it('the sender takes part for the Work whatever their standings', () => {
    expect(guildInvitePartyOf({ ...invite, uid: 'sender', member: member() })).toBe('work');
    expect(guildInvitePartyOf({ ...invite, uid: 'sender', member: null })).toBe('work');
  });

  it('a Steward, WorkProject Manager, or Invite Manager takes part for the Work', () => {
    for (const standing of ['StewardOwner', 'WorkProjectManager', 'InviteManager'] as const) {
      expect(guildInvitePartyOf({ ...invite, uid: 'handler', member: member({ guildStandings: [standing] }) })).toBe('work');
    }
  });

  it('any other guildmate — a Stake Share Manager included — takes no part', () => {
    expect(guildInvitePartyOf({ ...invite, uid: 'other', member: member({ guildStandings: ['StakeShareManager'] }) })).toBeNull();
    expect(guildInvitePartyOf({ ...invite, uid: 'other', member: member() })).toBeNull();
  });

  it('a departed handler, the founding-Work holder, and an outsider take no part', () => {
    expect(
      guildInvitePartyOf({ ...invite, uid: 'h', member: member({ status: 'departed', guildStandings: ['InviteManager'] }) }),
    ).toBeNull();
    expect(
      guildInvitePartyOf({
        ...invite,
        uid: 'h',
        member: member({ holderType: FOUNDING_WORK_HOLDER_TYPE, guildStandings: ['StewardOwner'] }),
      }),
    ).toBeNull();
    expect(guildInvitePartyOf({ ...invite, uid: 'outsider', member: null })).toBeNull();
    expect(guildInvitePartyOf({ ...invite, uid: '', member: null })).toBeNull();
  });

  it('the conversation is open while the invite is pending or accepted, and closed after', () => {
    expect([...GUILD_INVITE_CONVERSATION_LIVE_STATUSES]).toEqual(['pending', 'accepted']);
    expect(isGuildInviteConversationLive('finalized')).toBe(false);
    expect(isGuildInviteConversationLive('declined')).toBe(false);
    expect(isGuildInviteConversationLive('cancelled')).toBe(false);
    const handler = { ...invite, uid: 'h', member: member({ guildStandings: ['InviteManager'] }) };
    expect(canAccessGuildInviteConversation({ ...handler, status: 'pending' })).toBe(true);
    expect(canAccessGuildInviteConversation({ ...handler, status: 'finalized' })).toBe(false);
    expect(canAccessGuildInviteConversation({ ...invite, uid: 'outsider', member: null, status: 'pending' })).toBe(false);
  });
});

describe('who may cancel the Work invites', () => {
  it('any invite handler may cancel', () => {
    for (const standing of ['StewardOwner', 'WorkProjectManager', 'InviteManager'] as const) {
      expect(canCancelGuildInvite(member({ guildStandings: [standing] }))).toBe(true);
    }
  });

  it('a sender who holds no handler standing may not — sending gives no cancel power', () => {
    expect(canCancelGuildInvite(member({ guildStandings: ['StakeShareManager'] }))).toBe(false);
    expect(canCancelGuildInvite(member())).toBe(false);
  });

  it('a departed handler, the founding-Work holder, and someone with no guildmate record may not', () => {
    expect(canCancelGuildInvite(member({ status: 'departed', guildStandings: ['StewardOwner'] }))).toBe(false);
    expect(canCancelGuildInvite(member({ holderType: FOUNDING_WORK_HOLDER_TYPE, guildStandings: ['StewardOwner'] }))).toBe(false);
    expect(canCancelGuildInvite(null)).toBe(false);
  });
});
