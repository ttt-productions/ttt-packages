import { describe, it, expect } from 'vitest';
import {
  WORK_PUBLISH_REQUIREMENT_LABELS,
  checkWorkPublishReadiness,
  isWorkFirstPublication,
  realmCoverSubmitRule,
  type WorkPublishReadinessGuildmate,
  type WorkPublishReadinessInput,
} from '../src/utils/work-publish-readiness';
import { MAX_WORK_PROJECT_STAKE_SHARES } from '../src/constants/business-work-project';
import { FOUNDING_WORK_HOLDER_TYPE } from '../src/doc-schemas/work-project';

const steward: WorkPublishReadinessGuildmate = {
  status: 'active',
  stakeShareCount: MAX_WORK_PROJECT_STAKE_SHARES,
  tradeProfessions: ['Writer'],
};

function ready(overrides: Partial<WorkPublishReadinessInput> = {}): WorkPublishReadinessInput {
  return {
    work: { status: 'open', workingTitle: 'The Long Night', workingDescription: 'A story.' },
    section: {
      coverSquareAssetId: 'sq',
      coverPosterAssetId: 'po',
      coverCinematicAssetId: 'ci',
      workGenres: ['Fantasy'],
    },
    guildmates: [steward],
    realm: null,
    ...overrides,
  };
}

describe('checkWorkPublishReadiness — first publication', () => {
  it('is ready when every Work-level requirement is met', () => {
    const result = checkWorkPublishReadiness(ready());
    expect(result.firstPublication).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.unmet).toEqual([]);
    expect(result.totalShares).toBe(MAX_WORK_PROJECT_STAKE_SHARES);
  });

  it('lists the requirements in checklist order', () => {
    const result = checkWorkPublishReadiness(
      ready({ realm: { realmType: 'public', realmStatus: 'draft', realmCoverAssetId: 'c' } }),
    );
    expect(result.checks.map((check) => check.requirement)).toEqual([
      'title', 'description', 'covers', 'genres', 'realmCover', 'shares', 'collaborators',
    ]);
  });

  it("reads the Work's own title and description, and refuses blank or whitespace-only text", () => {
    for (const text of ['', '   ', '\n\t']) {
      const result = checkWorkPublishReadiness(
        ready({ work: { status: 'open', workingTitle: text, workingDescription: text } }),
      );
      expect(result.unmet).toEqual(['title', 'description']);
      expect(result.ready).toBe(false);
    }
  });

  it('requires all three covers', () => {
    const result = checkWorkPublishReadiness(
      ready({ section: { coverSquareAssetId: 'sq', coverPosterAssetId: 'po', workGenres: ['Fantasy'] } }),
    );
    expect(result.unmet).toEqual(['covers']);
  });

  it('requires at least one genre', () => {
    const result = checkWorkPublishReadiness(
      ready({ section: { coverSquareAssetId: 'sq', coverPosterAssetId: 'po', coverCinematicAssetId: 'ci', workGenres: [] } }),
    );
    expect(result.unmet).toEqual(['genres']);
  });

  it('requires the active shares to total the Work total, counting founding-Work holders and ignoring departed members', () => {
    const half = MAX_WORK_PROJECT_STAKE_SHARES / 2;
    const guildmates: WorkPublishReadinessGuildmate[] = [
      { status: 'active', stakeShareCount: half, tradeProfessions: ['Writer'] },
      { status: 'active', stakeShareCount: half, tradeProfessions: [], holderType: FOUNDING_WORK_HOLDER_TYPE },
      { status: 'departed', stakeShareCount: 7, tradeProfessions: ['Editor'] },
    ];
    const result = checkWorkPublishReadiness(ready({ guildmates }));
    expect(result.totalShares).toBe(MAX_WORK_PROJECT_STAKE_SHARES);
    expect(result.ready).toBe(true);

    const short = checkWorkPublishReadiness(ready({ guildmates: [guildmates[0]!] }));
    expect(short.unmet).toEqual(['shares']);
  });

  it('requires every active person to hold a share and a trade profession', () => {
    const result = checkWorkPublishReadiness(
      ready({
        guildmates: [
          { ...steward, stakeShareCount: MAX_WORK_PROJECT_STAKE_SHARES },
          { status: 'active', stakeShareCount: 0, tradeProfessions: ['Editor'] },
        ],
      }),
    );
    expect(result.unmet).toEqual(['collaborators']);

    const noProfession = checkWorkPublishReadiness(
      ready({ guildmates: [{ status: 'active', stakeShareCount: MAX_WORK_PROJECT_STAKE_SHARES, tradeProfessions: [] }] }),
    );
    expect(noProfession.unmet).toEqual(['collaborators']);
  });
});

describe('checkWorkPublishReadiness — after the first publication', () => {
  it("skips every first-publication requirement, so a departed member's retained shares never block the next item", () => {
    const result = checkWorkPublishReadiness(
      ready({
        work: { status: 'published', workingTitle: 'The Long Night', workingDescription: 'A story.' },
        guildmates: [{ status: 'active', stakeShareCount: 600, tradeProfessions: ['Writer'] }],
        section: { workGenres: [] },
      }),
    );
    expect(result.firstPublication).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.ready).toBe(true);
  });

  it('still applies the Realm-cover rule', () => {
    const result = checkWorkPublishReadiness(
      ready({
        work: { status: 'published', workingTitle: 'T', workingDescription: 'D' },
        realm: { realmType: 'public', realmStatus: 'draft' },
      }),
    );
    expect(result.unmet).toEqual(['realmCover']);
  });
});

describe('the first-publication phase', () => {
  it('lasts until the Work is published', () => {
    expect(isWorkFirstPublication({ status: 'open' })).toBe(true);
    expect(isWorkFirstPublication({ status: 'published' })).toBe(false);
  });
});

describe('realmCoverSubmitRule', () => {
  it('applies to a public draft Realm, met only with a cover', () => {
    expect(realmCoverSubmitRule({ realmType: 'public', realmStatus: 'draft' })).toEqual({ met: false });
    expect(realmCoverSubmitRule({ realmType: 'public', realmStatus: 'draft', realmCoverAssetId: '' })).toEqual({ met: false });
    expect(realmCoverSubmitRule({ realmType: 'public', realmStatus: 'draft', realmCoverAssetId: 'c' })).toEqual({ met: true });
  });

  it('does not apply to a released Realm, a standalone Realm, or no Realm', () => {
    expect(realmCoverSubmitRule({ realmType: 'public', realmStatus: 'released' })).toBeNull();
    expect(realmCoverSubmitRule({ realmType: 'standalone', realmStatus: 'draft' })).toBeNull();
    expect(realmCoverSubmitRule(null)).toBeNull();
  });

  it('blocks a first publication whose public draft Realm has no cover', () => {
    const result = checkWorkPublishReadiness(ready({ realm: { realmType: 'public', realmStatus: 'draft' } }));
    expect(result.unmet).toEqual(['realmCover']);
  });
});

describe('WORK_PUBLISH_REQUIREMENT_LABELS', () => {
  it('words the share requirement from the Work total', () => {
    expect(WORK_PUBLISH_REQUIREMENT_LABELS.shares).toBe(`Total work project shares equal ${MAX_WORK_PROJECT_STAKE_SHARES}`);
  });
});
