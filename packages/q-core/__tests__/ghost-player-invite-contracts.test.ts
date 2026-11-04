import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from '../src/paths/app-routes.js';
import { COLLECTIONS } from '../src/paths/collections.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { ShortLinkSchema } from '../src/doc-schemas/short-link.js';
import {
  CreateShortLinkInputSchema,
  UpdateShortLinkClickInputSchema,
} from '../src/schemas/short-links.js';
import {
  UpdateGhostPlayerLinkInviteInputSchema,
  UpdateGhostPlayerLinkInviteResultSchema,
} from '../src/schemas/ghost-player-invite.js';
import {
  LEAGUE_WAIVER_REQUIREMENT_LOCKED_MESSAGE,
  leagueWaiverRequirementChangeable,
} from '../src/utils/league-joining.js';
import { MEDIA_ORIGIN_SPECS } from '../src/media/file-origins.js';

const link = {
  shortId: 'AbC234',
  destinationUrl: '/league/L1/team/T1/invite/ghost_g1',
  type: 'ghostPlayerInvite',
  metadata: { teamId: 'T1', ghostUserId: 'ghost_g1' },
  createdAt: 1,
  createdBy: 'captain1',
  clicks: 0,
};

describe('the ghost invite link', () => {
  it('opens the invite page by league, team and ghost', () => {
    expect(APP_ROUTES.ghostPlayerInvite('L1', 'T1', 'ghost_g1')).toBe(
      '/league/L1/team/T1/invite/ghost_g1',
    );
    expect(APP_ROUTES.shortLink('AbC234')).toBe('/v/AbC234');
  });

  it('is stored in shortLinks under its short id, read by the registry schema', () => {
    expect(toPath(PATH_BUILDERS.shortLink('AbC234'))).toBe(`${COLLECTIONS.SHORT_LINKS}/AbC234`);
    expect(COLLECTION_SCHEMAS['shortLinks/{shortId}']).toBe(ShortLinkSchema);
    expect(ShortLinkSchema.parse(link)).toEqual(link);
  });

  it('has one target type, the ghost invite, naming the team and the ghost', () => {
    expect(ShortLinkSchema.safeParse({ ...link, type: 'audition' }).success).toBe(false);
    expect(ShortLinkSchema.safeParse({ ...link, metadata: { teamId: 'T1' } }).success).toBe(false);
  });

  it('is created for a team and ghost, and looked up by short id only', () => {
    expect(
      CreateShortLinkInputSchema.safeParse({
        targetType: 'ghostPlayerInvite',
        teamId: 'T1',
        ghostUserId: 'ghost_g1',
      }).success,
    ).toBe(true);
    expect(
      CreateShortLinkInputSchema.safeParse({ targetType: 'ghostPlayerInvite', teamId: 'T1' })
        .success,
    ).toBe(false);
    expect(UpdateShortLinkClickInputSchema.safeParse({ shortId: 'AbC234' }).success).toBe(true);
    expect(UpdateShortLinkClickInputSchema.safeParse({ shortId: 'a/b' }).success).toBe(false);
  });
});

describe('the invite press', () => {
  const signature = {
    waiverTemplateId: 'W1',
    waiverTemplateVersion: 2,
    storagePath: 'uploads/waiver-signature/signed-out/0b9a3c2e-7d1f-4e8a-9c3b-5f6a7d8e9f01',
  };

  it('carries the waiver signature and the registration only when the page sends them', () => {
    const base = { teamId: 'T1', ghostUserId: 'ghost_g1' };
    expect(UpdateGhostPlayerLinkInviteInputSchema.safeParse(base).success).toBe(true);
    expect(
      UpdateGhostPlayerLinkInviteInputSchema.safeParse({
        ...base,
        signature,
        registration: { displayName: 'Pat Player', acceptedTerms: true },
      }).success,
    ).toBe(true);
  });

  it('refuses a registration that did not accept the terms', () => {
    expect(
      UpdateGhostPlayerLinkInviteInputSchema.safeParse({
        teamId: 'T1',
        ghostUserId: 'ghost_g1',
        registration: { displayName: 'Pat Player', acceptedTerms: false },
      }).success,
    ).toBe(false);
  });

  it('answers linked, or that the registration expired', () => {
    expect(
      UpdateGhostPlayerLinkInviteResultSchema.safeParse({
        status: 'linked',
        leagueId: 'L1',
        teamId: 'T1',
        userId: 'u1',
      }).success,
    ).toBe(true);
    expect(
      UpdateGhostPlayerLinkInviteResultSchema.safeParse({ status: 'registrationExpired' }).success,
    ).toBe(true);
  });

  it('lets the waiver signature upload signed out, and no other origin', () => {
    expect(MEDIA_ORIGIN_SPECS['waiver-signature'].allowSignedOut).toBe(true);
    expect(MEDIA_ORIGIN_SPECS['hardware-signature'].allowSignedOut).toBe(false);
  });
});

describe("the league's waiver setting", () => {
  it('can be turned on or off only while the league has no team membership', () => {
    expect(leagueWaiverRequirementChangeable(false)).toBe(true);
    expect(leagueWaiverRequirementChangeable(true)).toBe(false);
    expect(LEAGUE_WAIVER_REQUIREMENT_LOCKED_MESSAGE).toBe(
      'This league already has players, so its waiver can no longer be turned on or off.',
    );
  });
});
