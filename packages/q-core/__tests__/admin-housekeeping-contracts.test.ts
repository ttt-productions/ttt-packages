// The admin housekeeping contracts — the award catalog and its grants, hardware loan contracts, the
// badge and hardware-signature upload origins, and the Fix stats inputs and report. The ban and unban
// contract is in auth-contracts.test.ts. Each test states the business rule the shape
// carries, not only that it parses.

import { describe, it, expect } from 'vitest';
import {
  HARDWARE_CATALOG,
  MAX_AWARD_GRANT_TARGETS,
  MAX_AWARD_NAME_LENGTH,
  MAX_STATS_VALIDATION_DISCREPANCIES,
  MEDIA_ORIGIN_SPECS,
  PICTURE_KINDS,
  isPictureOrigin,
  isSignatureOrigin,
} from '../src';
import {
  AwardDefinitionSchema,
  HardwareLoanContractSchema,
  PendingMediaTargetSchema,
  StatsValidationReportSchema,
  UserProfileSchema,
} from '../src/doc-schemas';
import { DomainEventSchema } from '../src/domain-events';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit';
import {
  AdminCorrectGameStatsInputSchema,
  AdminDeleteStatsValidationReportInputSchema,
  AdminDeleteStatsValidationReportResultSchema,
  AdminCreateHardwareLoanContractInputSchema,
  AdminUpdateAwardGrantsInputSchema,
  RecalculateLeagueStatsInputSchema,
  RunStatsValidationInputSchema,
  SubmitHardwareLoanContractSignatureInputSchema,
  UpdateFeaturedAwardsInputSchema,
  newAwardNameOf,
  parseTargetInfo,
} from '../src/schemas';

const NOW = 1712345678901;

describe('the award catalog', () => {
  it('keeps a name within its limit, a holder count, and no field it does not declare', () => {
    // A badge's picture id is its upload's staging id.
    const award = { name: 'MVP', badgePictureId: '3f2b6c1e-9a4d-4e8b-b7c2-5d1a0e9f8c34', holderCount: 0, createdAt: NOW, updatedAt: NOW };
    expect(AwardDefinitionSchema.safeParse(award).success).toBe(true);
    expect(AwardDefinitionSchema.safeParse({ ...award, name: 'x'.repeat(MAX_AWARD_NAME_LENGTH + 1) }).success).toBe(false);
    expect(AwardDefinitionSchema.safeParse({ ...award, holderCount: -1 }).success).toBe(false);
    // V1's image URLs are not part of an award: its badge is a picture.
    expect(AwardDefinitionSchema.safeParse({ ...award, imageUrl: 'https://example.test/a.png' }).success).toBe(false);
  });

  it('takes a grant change that names someone, never one account both granted and revoked, and bounded lists', () => {
    expect(AdminUpdateAwardGrantsInputSchema.safeParse({ awardId: 'a1', grantTeamIds: ['t1'] }).success).toBe(true);
    expect(AdminUpdateAwardGrantsInputSchema.safeParse({ awardId: 'a1' }).success).toBe(false);
    expect(AdminUpdateAwardGrantsInputSchema.safeParse({ awardId: 'a1', grantUserIds: [] }).success).toBe(false);
    expect(
      AdminUpdateAwardGrantsInputSchema.safeParse({ awardId: 'a1', grantUserIds: ['u1'], revokeUserIds: ['u1'] }).success,
    ).toBe(false);
    const tooMany = Array.from({ length: MAX_AWARD_GRANT_TARGETS + 1 }, (_, index) => `u${index}`);
    expect(AdminUpdateAwardGrantsInputSchema.safeParse({ awardId: 'a1', grantUserIds: tooMany }).success).toBe(false);
  });

  it('names a featured award by an award id, never a path', () => {
    expect(UserProfileSchema.shape.primaryAwardId.safeParse('award-7').success).toBe(true);
    expect(UserProfileSchema.shape.primaryAwardId.safeParse('awards/7').success).toBe(false);
    expect(UserProfileSchema.shape.secondaryAwardId.safeParse('').success).toBe(false);
  });

  it('features two different awards or none, and never names the account', () => {
    expect(UpdateFeaturedAwardsInputSchema.safeParse({ primaryAwardId: 'a1', secondaryAwardId: 'a2' }).success).toBe(true);
    expect(UpdateFeaturedAwardsInputSchema.safeParse({ primaryAwardId: null, secondaryAwardId: null }).success).toBe(true);
    expect(UpdateFeaturedAwardsInputSchema.safeParse({ primaryAwardId: 'a1', secondaryAwardId: 'a1' }).success).toBe(false);
    expect(
      UpdateFeaturedAwardsInputSchema.safeParse({ primaryAwardId: 'a1', secondaryAwardId: null, userId: 'u2' }).success,
    ).toBe(false);
  });
});

describe('the award badge upload', () => {
  it('is a square PNG cropped round, in three sizes', () => {
    expect(isPictureOrigin('award-badge')).toBe(true);
    expect(PICTURE_KINDS['award-badge']).toMatchObject({ aspect: 'square', format: 'png', cropShape: 'round' });
    expect(PICTURE_KINDS['award-badge'].sizes).toEqual({
      sm: { width: 64, height: 64 },
      md: { width: 256, height: 256 },
      lg: { width: 512, height: 512 },
    });
  });

  it('replaces an existing award\'s badge, or creates an award named by the upload\'s staging id', () => {
    expect(parseTargetInfo('award-badge', { awardId: 'a1' })).toEqual({ kind: 'awardDefinition', id: 'a1' });
    expect(parseTargetInfo('award-badge', { newAwardName: 'MVP' }, 'staging-1')).toEqual({ kind: 'awardDefinition', id: 'staging-1' });
    expect(() => parseTargetInfo('award-badge', { newAwardName: 'MVP' })).toThrow();
    expect(() => parseTargetInfo('award-badge', { awardId: 'a1', newAwardName: 'MVP' })).toThrow();
    expect(newAwardNameOf('award-badge', { newAwardName: 'MVP' })).toBe('MVP');
    expect(newAwardNameOf('award-badge', { awardId: 'a1' })).toBeUndefined();
    expect(newAwardNameOf('team-picture', { teamId: 't1' })).toBeUndefined();
  });

  it('carries a new award\'s name only on an award badge row', () => {
    expect(
      PendingMediaTargetSchema.safeParse({ owner: { kind: 'awardDefinition', id: 's1' }, newAwardName: 'MVP' }).success,
    ).toBe(true);
    expect(PendingMediaTargetSchema.safeParse({ owner: { kind: 'leagueTeam', id: 't1' }, newAwardName: 'MVP' }).success).toBe(
      false,
    );
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
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, signatureFile: undefined }).success).toBe(false);
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, returnedAt: NOW }).success).toBe(false);
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, status: 'returned', returnedAt: NOW }).success).toBe(true);
    expect(HardwareLoanContractSchema.safeParse({ ...loaned, status: 'returned' }).success).toBe(false);
  });

  it('keeps no signature URL and no display name — names resolve from public profiles', () => {
    expect(HardwareLoanContractSchema.safeParse({ ...pending, refereeName: 'Pat' }).success).toBe(false);
    expect(HardwareLoanContractSchema.safeParse({ ...pending, signatureDataUrl: 'data:image/png;base64,AA' }).success).toBe(false);
  });

  it('is created for catalog items named once, and signed by the caller without naming them', () => {
    const itemId = HARDWARE_CATALOG[0].id;
    expect(AdminCreateHardwareLoanContractInputSchema.safeParse({ refereeUserId: 'ref-1', hardwareItemIds: [itemId] }).success).toBe(true);
    expect(
      AdminCreateHardwareLoanContractInputSchema.safeParse({ refereeUserId: 'ref-1', hardwareItemIds: [itemId, itemId] }).success,
    ).toBe(false);
    expect(AdminCreateHardwareLoanContractInputSchema.safeParse({ refereeUserId: 'ref-1', hardwareItemIds: ['laptop'] }).success).toBe(
      false,
    );
    expect(AdminCreateHardwareLoanContractInputSchema.safeParse({ refereeUserId: 'ref-1', hardwareItemIds: [] }).success).toBe(false);
    expect(
      SubmitHardwareLoanContractSignatureInputSchema.safeParse({ contractId: 'c1', storagePath: 'staging/u1/x', userId: 'u1' }).success,
    ).toBe(false);
  });

  it('uploads its signature as a signature origin, never a picture', () => {
    expect(isSignatureOrigin('hardware-signature')).toBe(true);
    expect(isPictureOrigin('hardware-signature')).toBe(false);
    expect(MEDIA_ORIGIN_SPECS['hardware-signature']).toEqual(MEDIA_ORIGIN_SPECS['waiver-signature']);
  });
});

describe('Fix stats inputs', () => {
  it('takes a reason and an operation id on every rebuild, and a cursor only on a dry run', () => {
    const base = { leagueId: 'L', reason: 'Hand edit', operationId: 'op-1', dryRun: false };
    expect(RecalculateLeagueStatsInputSchema.safeParse(base).success).toBe(true);
    expect(RecalculateLeagueStatsInputSchema.safeParse({ ...base, reason: undefined }).success).toBe(false);
    expect(RecalculateLeagueStatsInputSchema.safeParse({ ...base, resumeAfter: 'L' }).success).toBe(false);
    expect(RecalculateLeagueStatsInputSchema.safeParse({ ...base, dryRun: true, resumeAfter: 'L' }).success).toBe(true);
  });

  it('corrects a game with values to set or by keeping the stored numbers — exactly one of the two', () => {
    const base = { gameId: 'g1', reason: 'Hand edit', operationId: 'op-1', dryRun: false };
    const target = { teamId: 't1', playerUserId: 'u1', stat: 'points', value: 4 };
    expect(AdminCorrectGameStatsInputSchema.safeParse({ ...base, targets: [target] }).success).toBe(true);
    expect(AdminCorrectGameStatsInputSchema.safeParse({ ...base, keepStored: true }).success).toBe(true);
    expect(AdminCorrectGameStatsInputSchema.safeParse(base).success).toBe(false);
    expect(AdminCorrectGameStatsInputSchema.safeParse({ ...base, targets: [target], keepStored: true }).success).toBe(false);
    expect(AdminCorrectGameStatsInputSchema.safeParse({ ...base, targets: [{ ...target, value: -1 }] }).success).toBe(false);
  });

  it('checks one game, one league, or everything — never a game and a league together — and takes no reason', () => {
    expect(RunStatsValidationInputSchema.safeParse({ operationId: 'c1', scope: {} }).success).toBe(true);
    expect(RunStatsValidationInputSchema.safeParse({ operationId: 'c1', scope: { gameId: 'g1' } }).success).toBe(true);
    expect(RunStatsValidationInputSchema.safeParse({ operationId: 'c1', scope: { gameId: 'g1', leagueId: 'L' } }).success).toBe(false);
    expect(RunStatsValidationInputSchema.safeParse({ operationId: 'c1', scope: {}, reason: 'x' }).success).toBe(false);
  });

  it('deletes one report named by one document id segment, takes no reason, and is audited and announced', () => {
    expect(AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId: 'c1' }).success).toBe(true);
    for (const reportId of ['', 'statsValidationReports/c1', '..']) {
      expect(AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId }).success).toBe(false);
    }
    expect(AdminDeleteStatsValidationReportInputSchema.safeParse({ reportId: 'c1', reason: 'x' }).success).toBe(false);
    expect(AdminDeleteStatsValidationReportResultSchema.safeParse({ reportId: 'c1' }).success).toBe(true);
    expect(AdminDeleteStatsValidationReportResultSchema.safeParse({ reportId: 'c1', deleted: true }).success).toBe(false);
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('stats.validationReportDeleted');
    expect(DomainEventSchema.safeParse({ type: 'statsValidation.reportDeleted', ids: { reportId: 'c1' } }).success).toBe(true);
    expect(DomainEventSchema.safeParse({ type: 'statsValidation.reportDeleted', ids: { reportId: 'a/b' } }).success).toBe(false);
  });

  it('keeps a report to its bounded list of findings, with every finding counted by kind', () => {
    const finding = { kind: 'rollupMismatch', gameId: 'g1', path: 'sportGames/g1', key: 't1_u1', field: 'points', expected: 5, actual: 9 };
    const report = {
      reportId: 'c1',
      operationId: 'c1',
      ranAt: NOW,
      ranByUserId: 'admin-1',
      scope: {},
      complete: true,
      discrepancies: [finding],
      discrepancyCounts: { rollupMismatch: 1 },
      summary: { totalGamesChecked: 1, totalUsersChecked: 0, totalTeamsChecked: 0, totalLeaguesChecked: 0, discrepanciesFound: 1 },
    };
    expect(StatsValidationReportSchema.safeParse(report).success).toBe(true);
    expect(StatsValidationReportSchema.safeParse({ ...report, discrepancies: [{ ...finding, kind: 'teamSeasonWins' }] }).success).toBe(
      false,
    );
    const tooMany = Array.from({ length: MAX_STATS_VALIDATION_DISCREPANCIES + 1 }, () => finding);
    expect(StatsValidationReportSchema.safeParse({ ...report, discrepancies: tooMany }).success).toBe(false);
  });
});
