import { describe, it, expect } from 'vitest';
import {
  HARDWARE_CATALOG,
  MAX_AWARD_GRANT_TARGETS,
  MAX_AWARD_NAME_LENGTH,
} from '../src/constants/business.js';
import { MAX_STATS_VALIDATION_DISCREPANCIES } from '../src/constants/sports.js';
import {
  MEDIA_ORIGIN_SPECS,
  PICTURE_KINDS,
  isPictureOrigin,
  isSignatureOrigin,
} from '../src/media/file-origins.js';
import { AwardDefinitionSchema } from '../src/doc-schemas/catalogs.js';
import { HardwareLoanContractSchema } from '../src/doc-schemas/waivers-and-hardware.js';
import { PendingMediaTargetSchema } from '../src/doc-schemas/pending-media.js';
import { StatsValidationReportSchema } from '../src/doc-schemas/system.js';
import { UserProfileSchema } from '../src/doc-schemas/user-profile.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  AdminCreateStatsJobInputSchema,
  AdminCreateStatsJobResultSchema,
  AdminGetStatsJobInputSchema,
  AdminGetStatsJobResultSchema,
  AdminDeleteStatsValidationReportInputSchema,
  AdminDeleteStatsValidationReportResultSchema,
  AdminUpdateSportGameStatsRecalculateInputSchema,
  AdminUpdateSportLeagueStatsRecalculateInputSchema,
  AdminUpdateUserProfileStatsRecalculateInputSchema,
  AdminCreateStatsValidationReportInputSchema,
} from '../src/schemas/stats.js';
import {
  AdminCreateHardwareLoanContractInputSchema,
  UpdateHardwareLoanContractSignInputSchema,
} from '../src/schemas/hardware-loan-contracts.js';
import {
  AdminUpdateAwardDefinitionGrantsInputSchema,
  UpdateUserProfileFeaturedAwardsInputSchema,
} from '../src/schemas/awards.js';
import { newAwardNameOf, parseTargetInfo } from '../src/schemas/uploads.js';

const NOW = 1712345678901;

describe('the award catalog', () => {
  it('keeps a name within its limit, a holder count, and no field it does not declare', () => {
    const award = {
      name: 'MVP',
      badgePictureId: '3f2b6c1e-9a4d-4e8b-b7c2-5d1a0e9f8c34',
      holderCount: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(AwardDefinitionSchema.safeParse(award).success).toBe(true);
    expect(
      AwardDefinitionSchema.safeParse({ ...award, name: 'x'.repeat(MAX_AWARD_NAME_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(AwardDefinitionSchema.safeParse({ ...award, holderCount: -1 }).success).toBe(false);
    expect(
      AwardDefinitionSchema.parse({ ...award, imageUrl: 'https://example.test/a.png' }),
    ).not.toHaveProperty('imageUrl');
  });

  it('takes a grant change that names someone, never one account both granted and revoked, and bounded lists', () => {
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({ awardId: 'a1', grantUserIds: ['u1'] })
        .success,
    ).toBe(true);
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({
        awardId: 'a1',
        revokeUserIds: ['u1'],
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({ awardId: 'a1', grantTeamIds: ['t1'] })
        .success,
    ).toBe(false);
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({
        awardId: 'a1',
        grantLeagueIds: ['l1'],
      }).success,
    ).toBe(false);
    expect(AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({ awardId: 'a1' }).success).toBe(
      false,
    );
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({ awardId: 'a1', grantUserIds: [] })
        .success,
    ).toBe(false);
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({
        awardId: 'a1',
        grantUserIds: ['u1'],
        revokeUserIds: ['u1'],
      }).success,
    ).toBe(false);
    const tooMany = Array.from({ length: MAX_AWARD_GRANT_TARGETS + 1 }, (_, index) => `u${index}`);
    expect(
      AdminUpdateAwardDefinitionGrantsInputSchema.safeParse({
        awardId: 'a1',
        grantUserIds: tooMany,
      }).success,
    ).toBe(false);
  });

  it('names a featured award by an award id, never a path', () => {
    expect(UserProfileSchema.shape.primaryAwardId.safeParse('award-7').success).toBe(true);
    expect(UserProfileSchema.shape.primaryAwardId.safeParse('awards/7').success).toBe(false);
    expect(UserProfileSchema.shape.secondaryAwardId.safeParse('').success).toBe(false);
  });

  it('takes the one change the person made to a featured slot: set, clear, or swap', () => {
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        action: 'set',
        slot: 'primary',
        awardId: 'a1',
      }).success,
    ).toBe(true);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        action: 'set',
        slot: 'secondary',
        awardId: 'a2',
      }).success,
    ).toBe(true);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({ action: 'clear', slot: 'secondary' })
        .success,
    ).toBe(true);
    expect(UpdateUserProfileFeaturedAwardsInputSchema.safeParse({ action: 'swap' }).success).toBe(
      true,
    );
  });

  it('never takes the whole pair, an unknown slot or intent, or a field another intent carries', () => {
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        primaryAwardId: 'a1',
        secondaryAwardId: 'a2',
      }).success,
    ).toBe(false);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        action: 'set',
        slot: 'tertiary',
        awardId: 'a1',
      }).success,
    ).toBe(false);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        action: 'replace',
        slot: 'primary',
        awardId: 'a1',
      }).success,
    ).toBe(false);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({ action: 'set', slot: 'primary' })
        .success,
    ).toBe(false);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({
        action: 'clear',
        slot: 'primary',
        awardId: 'a1',
      }).success,
    ).toBe(false);
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({ action: 'swap', slot: 'primary' })
        .success,
    ).toBe(false);
  });

  it('never names the account', () => {
    expect(
      UpdateUserProfileFeaturedAwardsInputSchema.safeParse({ action: 'swap', userId: 'u2' })
        .success,
    ).toBe(false);
  });
});

describe('the award badge upload', () => {
  it('is a square PNG cropped round, in three sizes', () => {
    expect(isPictureOrigin('award-badge')).toBe(true);
    expect(PICTURE_KINDS['award-badge']).toMatchObject({
      aspect: 'square',
      format: 'png',
      cropShape: 'round',
    });
    expect(PICTURE_KINDS['award-badge'].sizes).toEqual({
      sm: { width: 64, height: 64 },
      md: { width: 256, height: 256 },
      lg: { width: 512, height: 512 },
    });
  });

  it("replaces an existing award's badge, or creates an award named by the upload's staging id", () => {
    expect(parseTargetInfo('award-badge', { awardId: 'a1' })).toEqual({
      kind: 'awardDefinition',
      id: 'a1',
    });
    expect(parseTargetInfo('award-badge', { newAwardName: 'MVP' }, 'staging-1')).toEqual({
      kind: 'awardDefinition',
      id: 'staging-1',
    });
    expect(() => parseTargetInfo('award-badge', { newAwardName: 'MVP' })).toThrow();
    expect(() => parseTargetInfo('award-badge', { awardId: 'a1', newAwardName: 'MVP' })).toThrow();
    expect(newAwardNameOf('award-badge', { newAwardName: 'MVP' })).toBe('MVP');
    expect(newAwardNameOf('award-badge', { awardId: 'a1' })).toBeUndefined();
    expect(newAwardNameOf('team-picture', { teamId: 't1' })).toBeUndefined();
  });

  it("carries a new award's name only on an award badge row", () => {
    expect(
      PendingMediaTargetSchema.safeParse({
        owner: { kind: 'awardDefinition', id: 's1' },
        newAwardName: 'MVP',
      }).success,
    ).toBe(true);
    expect(
      PendingMediaTargetSchema.safeParse({
        owner: { kind: 'leagueTeam', id: 't1' },
        newAwardName: 'MVP',
      }).success,
    ).toBe(false);
  });
});

describe('hardware loan contracts', () => {
  const pending = {
    refereeUserId: 'ref-1',
    createdByUserId: 'admin-1',
    hardware: [{ id: HARDWARE_CATALOG[0].id, name: HARDWARE_CATALOG[0].name }],
    status: 'pending',
    createdAt: NOW,
  };
  const signatureFile = { bucket: 'q-sports-dev.appspot.com', path: 'signatures/hardware/c1.png' };

  it('carries the signature and the loan date exactly once signed, and the return date exactly once returned', () => {
    expect(HardwareLoanContractSchema.safeParse(pending).success).toBe(true);
    expect(HardwareLoanContractSchema.safeParse({ ...pending, signatureFile }).success).toBe(false);
    const loaned = { ...pending, status: 'loaned', signatureFile, loanedAt: NOW };
    expect(HardwareLoanContractSchema.safeParse(loaned).success).toBe(true);
    expect(
      HardwareLoanContractSchema.safeParse({ ...loaned, signatureFile: undefined }).success,
    ).toBe(false);
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, returnedAt: NOW }).success).toBe(
      false,
    );
    expect(
      HardwareLoanContractSchema.safeParse({ ...loaned, status: 'returned', returnedAt: NOW })
        .success,
    ).toBe(true);
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, status: 'returned' }).success).toBe(
      false,
    );
  });

  it('keeps no signature URL and no display name — names resolve from public profiles', () => {
    expect(HardwareLoanContractSchema.parse({ ...pending, refereeName: 'Pat' })).not.toHaveProperty(
      'refereeName',
    );
    expect(
      HardwareLoanContractSchema.parse({
        ...pending,
        signatureDataUrl: 'data:image/png;base64,AA',
      }),
    ).not.toHaveProperty('signatureDataUrl');
  });

  it('is created for catalog items named once, and signed by the caller without naming them', () => {
    const itemId = HARDWARE_CATALOG[0].id;
    expect(
      AdminCreateHardwareLoanContractInputSchema.safeParse({
        refereeUserId: 'ref-1',
        hardwareItemIds: [itemId],
      }).success,
    ).toBe(true);
    expect(
      AdminCreateHardwareLoanContractInputSchema.safeParse({
        refereeUserId: 'ref-1',
        hardwareItemIds: [itemId, itemId],
      }).success,
    ).toBe(false);
    expect(
      AdminCreateHardwareLoanContractInputSchema.safeParse({
        refereeUserId: 'ref-1',
        hardwareItemIds: ['laptop'],
      }).success,
    ).toBe(false);
    expect(
      AdminCreateHardwareLoanContractInputSchema.safeParse({
        refereeUserId: 'ref-1',
        hardwareItemIds: [],
      }).success,
    ).toBe(false);
    expect(
      UpdateHardwareLoanContractSignInputSchema.safeParse({
        contractId: 'c1',
        storagePath: 'staging/u1/x',
        userId: 'u1',
      }).success,
    ).toBe(false);
  });

  it('uploads its signature as a signature origin, never a picture', () => {
    expect(isSignatureOrigin('hardware-signature')).toBe(true);
    expect(isPictureOrigin('hardware-signature')).toBe(false);
    expect(MEDIA_ORIGIN_SPECS['hardware-signature']).toEqual(
      MEDIA_ORIGIN_SPECS['waiver-signature'],
    );
  });
});

describe('Fix stats inputs', () => {
  it('rebuilds one league or one person in one call, with an operation id, no reason and no cursor', () => {
    const base = { leagueId: 'L', operationId: 'op-1', dryRun: false };
    expect(AdminUpdateSportLeagueStatsRecalculateInputSchema.safeParse(base).success).toBe(true);
    for (const extra of [{ reason: 'Hand edit' }, { resumeAfter: 'L' }]) {
      expect(
        AdminUpdateSportLeagueStatsRecalculateInputSchema.safeParse({ ...base, ...extra }).success,
      ).toBe(false);
    }
    expect(
      AdminUpdateUserProfileStatsRecalculateInputSchema.safeParse({
        userId: 'ghost_1',
        operationId: 'op-1',
        dryRun: true,
      }).success,
    ).toBe(true);
  });

  it('fixes one game from its plays, with no choice of method and no reason', () => {
    const base = { gameId: 'g1', operationId: 'op-1', dryRun: false };
    expect(AdminUpdateSportGameStatsRecalculateInputSchema.safeParse(base).success).toBe(true);
    for (const extra of [{ reason: 'Hand edit' }, { keepStored: true }, { targets: [] }]) {
      expect(
        AdminUpdateSportGameStatsRecalculateInputSchema.safeParse({ ...base, ...extra }).success,
      ).toBe(false);
    }
  });

  it('starts everything as one background job, named by a request id', () => {
    expect(
      AdminCreateStatsJobInputSchema.safeParse({
        requestId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
    expect(AdminCreateStatsJobInputSchema.safeParse({ requestId: 'x' }).success).toBe(false);
    expect(
      AdminCreateStatsJobResultSchema.safeParse({
        jobId: 'admin-1_00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
    expect(AdminCreateStatsJobResultSchema.safeParse({ jobId: 'admin-1' }).success).toBe(false);
  });

  it("reads the latest job of a kind, any admin's, or none", () => {
    expect(AdminGetStatsJobInputSchema.safeParse({ kind: 'rebuild' }).success).toBe(true);
    expect(AdminGetStatsJobInputSchema.safeParse({ kind: 'archive' }).success).toBe(false);
    expect(AdminGetStatsJobResultSchema.safeParse({ job: null }).success).toBe(true);
  });

  it('checks one game or one league in one call, and everything with a request id only', () => {
    const check = (input: object) =>
      AdminCreateStatsValidationReportInputSchema.safeParse(input).success;
    expect(check({ scope: {}, requestId: '00000000-0000-4000-8000-000000000000' })).toBe(true);
    expect(check({ scope: {} })).toBe(false);
    expect(check({ scope: { gameId: 'g1' } })).toBe(true);
    expect(
      check({ scope: { leagueId: 'L' }, requestId: '00000000-0000-4000-8000-000000000000' }),
    ).toBe(false);
    expect(check({ scope: { gameId: 'g1', leagueId: 'L' } })).toBe(false);
    expect(check({ scope: { gameId: 'g1' }, operationId: 'c1' })).toBe(false);
    expect(check({ scope: { gameId: 'g1' }, reason: 'x' })).toBe(false);
  });

  it('deletes one report named by one document id segment, takes no reason, and is audited and announced', () => {
    expect(AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId: 'c1' }).success).toBe(
      true,
    );
    for (const reportId of ['', 'statsValidationReports/c1', '..']) {
      expect(AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId }).success).toBe(
        false,
      );
    }
    expect(
      AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId: 'c1', reason: 'x' })
        .success,
    ).toBe(false);
    expect(AdminDeleteStatsValidationReportResultSchema.safeParse({ reportId: 'c1' }).success).toBe(
      true,
    );
    expect(
      AdminDeleteStatsValidationReportResultSchema.safeParse({ reportId: 'c1', deleted: true })
        .success,
    ).toBe(false);
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('statsValidationReport.deleted');
    expect(
      DomainEventSchema.safeParse({
        type: 'statsValidationReport.deleted',
        ids: { reportId: 'c1' },
      }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({
        type: 'statsValidationReport.deleted',
        ids: { reportId: 'a/b' },
      }).success,
    ).toBe(false);
  });

  it('keeps a report to its bounded list of findings, with every finding counted by kind', () => {
    const finding = {
      kind: 'rollupMismatch',
      gameId: 'g1',
      path: 'sportGames/g1',
      key: 't1_u1',
      field: 'points',
      expected: 5,
      actual: 9,
    };
    const report = {
      reportId: 'c1',
      operationId: 'c1',
      ranAt: NOW,
      ranByUserId: 'admin-1',
      scope: {},
      complete: true,
      discrepancies: [finding],
      discrepancyCounts: { rollupMismatch: 1 },
      summary: {
        totalGamesChecked: 1,
        totalUsersChecked: 0,
        totalTeamsChecked: 0,
        totalLeaguesChecked: 0,
        discrepanciesFound: 1,
      },
    };
    expect(StatsValidationReportSchema.safeParse(report).success).toBe(true);
    expect(
      StatsValidationReportSchema.safeParse({
        ...report,
        discrepancies: [{ ...finding, kind: 'teamSeasonWins' }],
      }).success,
    ).toBe(false);
    const tooMany = Array.from({ length: MAX_STATS_VALIDATION_DISCREPANCIES + 1 }, () => finding);
    expect(
      StatsValidationReportSchema.safeParse({ ...report, discrepancies: tooMany }).success,
    ).toBe(false);
  });
});
