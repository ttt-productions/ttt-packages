// The public collaborator roster projection is a PRIVACY BOUNDARY, and it used to have
// two implementations: the mirror trigger core in ttt-prod and a hand-copied restatement
// in the post-deploy backfill script, under a "keep in sync" comment. A drifted copy is
// how a non-public field (guild standings, stake counts) reaches a subcollection every
// signed-in user can read. ttt-core now owns the one projection; these tests pin the two
// rules that protect it and fail if the projected field set ever drifts from
// GUILDMATE_USER_PUBLIC_FIELDS.

import { describe, it, expect } from 'vitest';
import {
  GUILDMATE_USER_PUBLIC_FIELDS,
  buildPublicGuildmateUserPayload,
  publicGuildmateUserPayloadEqual,
} from '../src/types/work-project';
import {
  FOUNDING_WORK_HOLDER_TYPE,
  PublicGuildmateUserSchema,
} from '../src/doc-schemas/work-project';

const guildmate = {
  uid: 'u1',
  guildStandings: ['StewardOwner'],
  tradeProfessions: ['Director', 'Editor'],
  stakeShareCount: 250,
  joinedAt: 1_700_000_000_000,
  status: 'active',
};

describe('buildPublicGuildmateUserPayload', () => {
  it('projects exactly GUILDMATE_USER_PUBLIC_FIELDS and nothing else', () => {
    const payload = buildPublicGuildmateUserPayload('u1', guildmate);
    expect(payload).not.toBeNull();
    expect(Object.keys(payload!).sort()).toEqual([...GUILDMATE_USER_PUBLIC_FIELDS].sort());
    expect(PublicGuildmateUserSchema.safeParse(payload).success).toBe(true);
  });

  it('never projects guild standings or stake counts', () => {
    const payload = buildPublicGuildmateUserPayload('u1', guildmate) as Record<string, unknown>;
    expect(payload.guildStandings).toBeUndefined();
    expect(payload.stakeShareCount).toBeUndefined();
  });

  it('returns null for the founding-Work holder — a ledger entry, not a person', () => {
    expect(
      buildPublicGuildmateUserPayload('wp1', { ...guildmate, holderType: FOUNDING_WORK_HOLDER_TYPE }),
    ).toBeNull();
  });

  it('RETAINS a departed guildmate — historical collaborator credit', () => {
    const payload = buildPublicGuildmateUserPayload('u1', { ...guildmate, status: 'departed' });
    expect(payload).not.toBeNull();
    expect(payload!.status).toBe('departed');
  });

  it('returns null for a deleted guildmate doc', () => {
    expect(buildPublicGuildmateUserPayload('u1', null)).toBeNull();
    expect(buildPublicGuildmateUserPayload('u1', undefined)).toBeNull();
  });

  it('coerces missing/malformed optional inputs rather than emitting an invalid doc', () => {
    const payload = buildPublicGuildmateUserPayload('u1', { status: 'active' });
    expect(payload).toEqual({ uid: 'u1', tradeProfessions: [], joinedAt: 0, status: 'active' });
    expect(PublicGuildmateUserSchema.safeParse(payload).success).toBe(true);
  });
});

describe('publicGuildmateUserPayloadEqual', () => {
  const base = buildPublicGuildmateUserPayload('u1', guildmate);

  it('treats two null projections as equal and a one-sided null as different', () => {
    expect(publicGuildmateUserPayloadEqual(null, null)).toBe(true);
    expect(publicGuildmateUserPayloadEqual(base, null)).toBe(false);
    expect(publicGuildmateUserPayloadEqual(null, base)).toBe(false);
  });

  it('is true for an identical re-projection', () => {
    expect(publicGuildmateUserPayloadEqual(base, buildPublicGuildmateUserPayload('u1', guildmate))).toBe(true);
  });

  it('detects a change in every projected field', () => {
    expect(publicGuildmateUserPayloadEqual(base, { ...base!, uid: 'u2' })).toBe(false);
    expect(publicGuildmateUserPayloadEqual(base, { ...base!, status: 'departed' })).toBe(false);
    expect(publicGuildmateUserPayloadEqual(base, { ...base!, joinedAt: 1 })).toBe(false);
    expect(publicGuildmateUserPayloadEqual(base, { ...base!, tradeProfessions: ['Director'] })).toBe(false);
  });

  it('is order-sensitive on tradeProfessions', () => {
    expect(
      publicGuildmateUserPayloadEqual(base, { ...base!, tradeProfessions: ['Editor', 'Director'] }),
    ).toBe(false);
  });
});
