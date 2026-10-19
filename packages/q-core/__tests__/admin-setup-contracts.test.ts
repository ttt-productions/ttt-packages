// The admin dashboard counts, waiver templates, and game locations: their document shapes, their
// callable contracts, and the ids and unions they are built on.

import { describe, it, expect } from 'vitest';
import {
  buildWaiverTemplateVersionId,
  parseWaiverTemplateVersionId,
} from '../src/ids/waiver-template-ids.js';
import {
  ACTIVE_LEAGUE_STATUS,
  COMPLETED_GAME_STATUS,
  CURRENT_LEAGUE_STATUS_KEYS,
  GAME_STATUS_KEYS,
  LEAGUE_STATUS_KEYS,
  OPEN_GAME_STATUS_KEYS,
  OPEN_LEAGUE_STATUS_KEYS,
  UPCOMING_LEAGUE_STATUS,
} from '../src/types/unions.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  MAX_GAME_LOCATION_MEMO_LENGTH,
  MAX_WAIVER_TEMPLATE_TEXT_LENGTH,
  MAX_WAIVER_TEMPLATE_TITLE_LENGTH,
} from '../src/constants/business.js';
import { GameLocationSchema } from '../src/doc-schemas/game-location.js';
import {
  WaiverTemplateSchema,
  WaiverTemplateVersionSchema,
} from '../src/doc-schemas/waiver-template.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import {
  AdminCreateGameLocationInputSchema,
  AdminUpdateGameLocationInputSchema,
} from '../src/schemas/game-locations.js';
import {
  AdminCreateWaiverTemplateInputSchema,
  AdminDeleteWaiverTemplateResultSchema,
  AdminUpdateWaiverTemplateInputSchema,
} from '../src/schemas/waiver-templates.js';
import {
  AdminStatsSchema,
  GetAdminStatsInputSchema,
  GetAdminStatsResultSchema,
} from '../src/schemas/admin-stats.js';
import { COLLECTIONS } from '../src/paths/collections.js';

const COUNTS = {
  totalUsers: 478,
  totalTeams: 165,
  totalLeagues: 12,
  activeLeagues: 2,
  upcomingLeagues: 1,
  totalGamesPlayed: 457,
  activeFreeAgents: 3,
  teamsByYear: { '2024': 90, '2025': 75 },
  updatedAt: 1_760_000_000_000,
};

describe('waiver template version ids', () => {
  it('build `v{version}` and parse it back', () => {
    expect(buildWaiverTemplateVersionId(1)).toBe('v1');
    expect(buildWaiverTemplateVersionId(12)).toBe('v12');
    expect(parseWaiverTemplateVersionId('v12')).toBe(12);
  });

  it('refuse a version that is not a whole number from 1', () => {
    expect(() => buildWaiverTemplateVersionId(0)).toThrow();
    expect(() => buildWaiverTemplateVersionId(1.5)).toThrow();
    expect(parseWaiverTemplateVersionId('v0')).toBeNull();
    expect(parseWaiverTemplateVersionId('v01')).toBeNull();
    expect(parseWaiverTemplateVersionId('1')).toBeNull();
  });
});

describe('league status subsets', () => {
  it('open is every status but closed', () => {
    expect(
      LEAGUE_STATUS_KEYS.filter(
        (status) => !(OPEN_LEAGUE_STATUS_KEYS as readonly string[]).includes(status),
      ),
    ).toEqual(['closed']);
  });

  it('current is the published leagues that are not closed', () => {
    expect([...CURRENT_LEAGUE_STATUS_KEYS].sort()).toEqual(['active', 'upcoming']);
    expect(CURRENT_LEAGUE_STATUS_KEYS).toEqual([UPCOMING_LEAGUE_STATUS, ACTIVE_LEAGUE_STATUS]);
  });
});

describe('game status', () => {
  it('has exactly one finished status — every status that is not open is the completed one', () => {
    const finished = GAME_STATUS_KEYS.filter(
      (status) => !(OPEN_GAME_STATUS_KEYS as readonly string[]).includes(status),
    );
    expect(finished).toEqual([COMPLETED_GAME_STATUS]);
  });
});

describe('the admin dashboard counts', () => {
  it('accept the counts with the teams-per-year breakdown', () => {
    expect(AdminStatsSchema.safeParse(COUNTS).success).toBe(true);
  });

  it('key the breakdown by a four-digit year only', () => {
    expect(AdminStatsSchema.safeParse({ ...COUNTS, teamsByYear: { '25': 3 } }).success).toBe(false);
    expect(
      AdminStatsSchema.safeParse({ ...COUNTS, teamsByYear: { '2025-09-01': 3 } }).success,
    ).toBe(false);
  });

  it('refuse a count that is not a whole, non-negative number', () => {
    expect(AdminStatsSchema.safeParse({ ...COUNTS, totalUsers: -1 }).success).toBe(false);
    expect(AdminStatsSchema.safeParse({ ...COUNTS, activeFreeAgents: 1.5 }).success).toBe(false);
  });

  it('are counted on every read, so no document stores them and no admin-read bucket exists', () => {
    expect(Object.keys(COLLECTION_SCHEMAS).filter((path) => path.endsWith('/adminStats'))).toEqual(
      [],
    );
    expect(Object.values(COLLECTIONS)).not.toContain('_adminData');
  });

  it('take no read input', () => {
    for (const input of [{}, undefined, null]) {
      expect(GetAdminStatsInputSchema.safeParse(input).success).toBe(true);
    }
    expect(GetAdminStatsInputSchema.safeParse({ force: true }).success).toBe(false);
  });

  it('answer the counts as they were taken, never an absent set', () => {
    expect(GetAdminStatsResultSchema.safeParse({ stats: COUNTS }).success).toBe(true);
    expect(GetAdminStatsResultSchema.safeParse({ stats: null }).success).toBe(false);
  });
});

describe('waiver templates', () => {
  const template = {
    title: 'Season waiver',
    waiverText: 'Terms.',
    version: 2,
    createdAt: 1,
    updatedAt: 2,
    retired: false,
  };

  it('carry the current version number and an optional retirement', () => {
    expect(WaiverTemplateSchema.safeParse(template).success).toBe(true);
    expect(
      WaiverTemplateSchema.safeParse({ ...template, retired: true, retiredAt: 3 }).success,
    ).toBe(true);
    expect(WaiverTemplateSchema.safeParse({ ...template, version: 0 }).success).toBe(false);
  });

  it('say whether they are retired, so the offered ones are a query filter, true exactly when retired', () => {
    const { retired: _retired, ...withoutFlag } = template;
    expect(WaiverTemplateSchema.safeParse(withoutFlag).success).toBe(false);
    expect(WaiverTemplateSchema.safeParse({ ...template, retiredAt: 3 }).success).toBe(false);
    expect(WaiverTemplateSchema.safeParse({ ...template, retired: true }).success).toBe(false);
  });

  it('carry the time a league last chose the template, apart from when the template changed', () => {
    const parsed = WaiverTemplateSchema.parse({ ...template, lastChosenAt: 5 });
    expect(parsed).toMatchObject({ lastChosenAt: 5, updatedAt: 2 });
    expect(WaiverTemplateSchema.safeParse({ ...template, lastChosenAt: -1 }).success).toBe(false);
  });

  it('keep each published version, with or without a recorded author', () => {
    const version = { version: 1, title: 'Season waiver', waiverText: 'Terms.', publishedAt: 1 };
    expect(WaiverTemplateVersionSchema.safeParse(version).success).toBe(true);
    expect(
      WaiverTemplateVersionSchema.safeParse({ ...version, publishedByUserId: 'admin-1' }).success,
    ).toBe(true);
  });

  it('refuse blank or oversized wording at the callable', () => {
    expect(
      AdminCreateWaiverTemplateInputSchema.safeParse({ title: ' ', waiverText: 'x' }).success,
    ).toBe(false);
    expect(
      AdminCreateWaiverTemplateInputSchema.safeParse({
        title: 'x'.repeat(MAX_WAIVER_TEMPLATE_TITLE_LENGTH + 1),
        waiverText: 'x',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateWaiverTemplateInputSchema.safeParse({
        waiverTemplateId: 'w1',
        expectedVersion: 1,
        title: 'Waiver',
        waiverText: 'x'.repeat(MAX_WAIVER_TEMPLATE_TEXT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('take, with new wording, the version the editor loaded, so a stale base can be refused', () => {
    const save = {
      waiverTemplateId: 'w1',
      expectedVersion: 2,
      title: 'Waiver',
      waiverText: 'Terms.',
    };
    expect(AdminUpdateWaiverTemplateInputSchema.safeParse(save).success).toBe(true);
    const { expectedVersion: _loaded, ...withoutBase } = save;
    expect(AdminUpdateWaiverTemplateInputSchema.safeParse(withoutBase).success).toBe(false);
    expect(
      AdminUpdateWaiverTemplateInputSchema.safeParse({ ...save, expectedVersion: 0 }).success,
    ).toBe(false);
  });

  it("keep a waiver's title and wording exactly as typed, since a player signs those words", () => {
    const parsed = AdminCreateWaiverTemplateInputSchema.parse({
      title: '  Season waiver ',
      waiverText: ' Terms.\n',
    });
    expect(parsed).toEqual({ title: '  Season waiver ', waiverText: ' Terms.\n' });
  });

  it('report a delete as deleted or retired, nothing else', () => {
    expect(
      AdminDeleteWaiverTemplateResultSchema.safeParse({
        waiverTemplateId: 'w1',
        outcome: 'retired',
      }).success,
    ).toBe(true);
    expect(
      AdminDeleteWaiverTemplateResultSchema.safeParse({
        waiverTemplateId: 'w1',
        outcome: 'archived',
      }).success,
    ).toBe(false);
  });
});

describe('game locations', () => {
  const fields = {
    name: 'Northside',
    streetAddress: '12 Court St',
    subLocations: ['Court 1'],
    memo: '',
  };
  // A picture id is its upload's staging id, a lowercase UUID.
  const PICTURE_ID = '6a1c0f3e-2b4d-4c5e-9f7a-8b0c1d2e3f40';

  it('store one venue per document, its picture by id only', () => {
    const stored = {
      name: 'Northside',
      streetAddress: '12 Court St',
      subLocations: [],
      createdAt: 1,
      updatedAt: 1,
    };
    expect(GameLocationSchema.safeParse(stored).success).toBe(true);
    expect(GameLocationSchema.safeParse({ ...stored, pictureId: PICTURE_ID }).success).toBe(true);
    expect(GameLocationSchema.safeParse({ ...stored, pictureId: 'pic-1' }).success).toBe(false);
    expect(GameLocationSchema.shape).not.toHaveProperty('imageUrl');
    expect(GameLocationSchema.safeParse({ ...stored, memo: '' }).success).toBe(false);
  });

  it('take the venue fields, trimmed and bounded, and nothing else', () => {
    expect(
      AdminCreateGameLocationInputSchema.parse({ ...fields, name: '  Northside  ' }).name,
    ).toBe('Northside');
    expect(
      AdminCreateGameLocationInputSchema.safeParse({
        ...fields,
        memo: 'x'.repeat(MAX_GAME_LOCATION_MEMO_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateGameLocationInputSchema.safeParse({
        ...fields,
        gameLocationId: 'loc-1',
        pictureId: PICTURE_ID,
      }).success,
    ).toBe(false);
  });

  it('edit only the fields the admin changed, at least one, and nothing undeclared', () => {
    const edit = (changed: object) =>
      AdminUpdateGameLocationInputSchema.safeParse({ gameLocationId: 'loc-1', ...changed }).success;
    expect(edit({ memo: 'Park on the street.' })).toBe(true);
    expect(edit({ name: 'Northside', subLocations: ['Court 1', 'Court 2'] })).toBe(true);
    expect(edit(fields)).toBe(true);
    expect(edit({})).toBe(false);
    expect(edit({ capacity: 40 })).toBe(false);
    expect(AdminUpdateGameLocationInputSchema.safeParse({ memo: 'x' }).success).toBe(false);
  });

  it('refuse a line break in a one-line field, and allow one in the memo', () => {
    expect(
      AdminCreateGameLocationInputSchema.safeParse({ ...fields, name: 'North\nside' }).success,
    ).toBe(false);
    expect(
      AdminCreateGameLocationInputSchema.safeParse({ ...fields, streetAddress: '12\nCourt St' })
        .success,
    ).toBe(false);
    expect(
      AdminCreateGameLocationInputSchema.safeParse({ ...fields, subLocations: ['Court\n1'] })
        .success,
    ).toBe(false);
    expect(
      AdminCreateGameLocationInputSchema.parse({ ...fields, memo: '  Park in back.\nSide door.  ' })
        .memo,
    ).toBe('Park in back.\nSide door.');
  });
});

describe('the vocabulary these actions record and announce', () => {
  it('declares every audit event type they write', () => {
    for (const type of [
      'waiverTemplate.created',
      'waiverTemplate.versionPublished',
      'waiverTemplate.retired',
      'waiverTemplate.deleted',
      'gameLocation.created',
      'gameLocation.updated',
      'gameLocation.deleted',
    ]) {
      expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain(type);
    }
  });

  it('declares their domain events', () => {
    expect(
      DomainEventSchema.safeParse({
        type: 'waiverTemplate.updated',
        ids: { waiverTemplateId: 'w1' },
      }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({
        type: 'gameLocation.deleted',
        ids: { gameLocationId: 'loc-1' },
      }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'gameLocation.deleted', ids: { locationId: 'loc-1' } })
        .success,
    ).toBe(false);
  });
});
