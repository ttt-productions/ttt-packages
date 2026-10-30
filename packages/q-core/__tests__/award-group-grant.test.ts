import { describe, it, expect } from 'vitest';
import {
  buildAwardGroupGrantId,
  buildAwardGroupGrantTargetKey,
} from '../src/ids/award-grant-ids.js';
import {
  AwardGroupGrantPersonSchema,
  AwardGroupGrantSchema,
  awardGroupGrantOpens,
} from '../src/doc-schemas/award-group-grant.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import {
  AdminGetAwardGroupGrantStatusInputSchema,
  AdminGetAwardGroupGrantStatusResultSchema,
  AdminUpdateAwardGroupGrantInputSchema,
  AdminUpdateAwardGroupGrantResultSchema,
} from '../src/schemas/awards.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';

const target = { awardId: 'award-1', groupType: 'league', groupId: 'league-1' } as const;
const targetKey = buildAwardGroupGrantTargetKey(target);
const grant = {
  grantId: buildAwardGroupGrantId(targetKey, 1),
  action: 'grant',
  ...target,
  targetKey,
  decision: 1,
  actorUid: 'admin-1',
  status: 'pending',
  createdAt: 1,
  attemptCount: 0,
  nextAttemptAt: 2,
};

describe('a group grant decision', () => {
  it('records a grant or a revoke of an award for a team or a league', () => {
    for (const action of ['grant', 'revoke']) {
      for (const groupType of ['team', 'league'] as const) {
        const key = buildAwardGroupGrantTargetKey({ ...target, groupType });
        const decision = {
          ...grant,
          action,
          groupType,
          targetKey: key,
          grantId: buildAwardGroupGrantId(key, 1),
        };
        expect(AwardGroupGrantSchema.safeParse(decision).success, `${action} ${groupType}`).toBe(
          true,
        );
      }
    }
    expect(AwardGroupGrantSchema.safeParse({ ...grant, action: 'hide' }).success).toBe(false);
    expect(AwardGroupGrantSchema.safeParse({ ...grant, groupType: 'user' }).success).toBe(false);
  });

  it('gives every decision on one award and group one key, and each decision its own id by number', () => {
    expect(buildAwardGroupGrantTargetKey(target)).toBe(targetKey);
    expect(buildAwardGroupGrantId(targetKey, 1)).not.toBe(buildAwardGroupGrantId(targetKey, 2));
    expect(buildAwardGroupGrantTargetKey({ ...target, groupType: 'team' })).not.toBe(targetKey);
    expect(
      buildAwardGroupGrantTargetKey({ awardId: 'a1', groupType: 'team', groupId: '2' }),
    ).not.toBe(buildAwardGroupGrantTargetKey({ awardId: 'a', groupType: 'team', groupId: '12' }));
  });

  it('refuses a decision whose key or id is not derived from its award, group, and number', () => {
    expect(AwardGroupGrantSchema.safeParse({ ...grant, targetKey: 'other' }).success).toBe(false);
    expect(AwardGroupGrantSchema.safeParse({ ...grant, grantId: 'random-id' }).success).toBe(false);
    expect(AwardGroupGrantSchema.safeParse({ ...grant, decision: 2 }).success).toBe(false);
    expect(AwardGroupGrantSchema.safeParse({ ...grant, groupId: 'league-2' }).success).toBe(false);
  });

  it('numbers decisions from 1 in whole steps', () => {
    for (const decision of [0, 1.5, -1]) {
      const id = buildAwardGroupGrantId(targetKey, decision);
      expect(
        AwardGroupGrantSchema.safeParse({ ...grant, decision, grantId: id }).success,
        String(decision),
      ).toBe(false);
    }
  });

  it('stays pending with a retry ledger until it is complete', () => {
    expect(
      AwardGroupGrantSchema.safeParse({
        ...grant,
        attemptCount: 3,
        nextAttemptAt: 10,
        lastError: 'profile write failed',
      }).success,
    ).toBe(true);
    expect(
      AwardGroupGrantSchema.safeParse({ ...grant, status: 'complete', completedAt: 5 }).success,
    ).toBe(true);
    expect(AwardGroupGrantSchema.safeParse({ ...grant, status: 'failed' }).success).toBe(false);
    const { attemptCount: _attempts, ...withoutLedger } = grant;
    expect(AwardGroupGrantSchema.safeParse(withoutLedger).success).toBe(false);
  });

  it('is bound in the collection registry at its path builder', () => {
    expect(toPath(PATH_BUILDERS.awardGroupGrant(grant.grantId))).toBe(
      `awardGroupGrants/${grant.grantId}`,
    );
    expect(COLLECTION_SCHEMAS['awardGroupGrants/{grantId}']).toBe(AwardGroupGrantSchema);
    expect(toPath(PATH_BUILDERS.awardGroupGrantPerson(grant.grantId, 'u1'))).toBe(
      `awardGroupGrants/${grant.grantId}/awardGroupGrantPeople/u1`,
    );
    expect(COLLECTION_SCHEMAS['awardGroupGrants/{grantId}/awardGroupGrantPeople/{userId}']).toBe(
      AwardGroupGrantPersonSchema,
    );
  });
});

describe('which request opens a new decision', () => {
  it('opens a grant when the group has no decision yet, and no take-back', () => {
    expect(awardGroupGrantOpens(null, 'grant')).toBe(true);
    expect(awardGroupGrantOpens(null, 'revoke')).toBe(false);
  });

  it('opens only a take-back after a grant, whether that grant is finished or still under way', () => {
    expect(awardGroupGrantOpens({ action: 'grant' }, 'grant')).toBe(false);
    expect(awardGroupGrantOpens({ action: 'grant' }, 'revoke')).toBe(true);
  });

  it('opens only a grant after a take-back', () => {
    expect(awardGroupGrantOpens({ action: 'revoke' }, 'grant')).toBe(true);
    expect(awardGroupGrantOpens({ action: 'revoke' }, 'revoke')).toBe(false);
  });
});

describe('the record a group grant keeps of one person', () => {
  const person = { userId: 'u1', heldBefore: false, recordedAt: 1, revoked: false };

  it('says whether the person held the award before the grant reached them', () => {
    expect(AwardGroupGrantPersonSchema.safeParse(person).success).toBe(true);
    expect(AwardGroupGrantPersonSchema.safeParse({ ...person, heldBefore: true }).success).toBe(
      true,
    );
    const { heldBefore: _held, ...withoutHeld } = person;
    expect(AwardGroupGrantPersonSchema.safeParse(withoutHeld).success).toBe(false);
  });

  it('records a revoke, and why a revoke left the person holding the award', () => {
    expect(
      AwardGroupGrantPersonSchema.safeParse({ ...person, revoked: true, revokedAt: 2 }).success,
    ).toBe(true);
    for (const revokeSkipped of ['heldBefore', 'heldByAnotherGrant']) {
      expect(
        AwardGroupGrantPersonSchema.safeParse({
          ...person,
          revoked: true,
          revokedAt: 2,
          revokeSkipped,
        }).success,
      ).toBe(true);
    }
    expect(
      AwardGroupGrantPersonSchema.safeParse({ ...person, revokeSkipped: 'other' }).success,
    ).toBe(false);
  });

  it('holds an id reference and no name (RULE-STD-ARCH-103)', () => {
    expect(AwardGroupGrantPersonSchema.safeParse({ ...person, displayName: 'Pat' }).success).toBe(
      false,
    );
  });
});

describe('the group grant callables', () => {
  const group = { groupType: 'team', groupId: 't1' };

  it('take one award, grant or revoke, and one team or league', () => {
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({ awardId: 'a1', action: 'grant', group })
        .success,
    ).toBe(true);
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({ awardId: 'a1', action: 'revoke', group })
        .success,
    ).toBe(true);
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({ awardId: 'a1', action: 'grant' }).success,
    ).toBe(false);
    const asUser = { groupType: 'user', groupId: 'u1' };
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({
        awardId: 'a1',
        action: 'grant',
        group: asUser,
      }).success,
    ).toBe(false);
    const asPath = { groupType: 'team', groupId: 't/1' };
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({
        awardId: 'a1',
        action: 'grant',
        group: asPath,
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateAwardGroupGrantInputSchema.safeParse({
        awardId: 'a1',
        action: 'grant',
        group,
        reason: 'x',
      }).success,
    ).toBe(false);
  });

  it('answer with the decision as it stands, pending or complete, and its failure', () => {
    const progress = {
      grantId: grant.grantId,
      action: 'grant',
      decision: 1,
      status: 'pending',
      peopleReached: 120,
      attemptCount: 1,
      lastError: 'profile write failed',
      createdAt: 1,
      completedAt: null,
    };
    expect(
      AdminUpdateAwardGroupGrantResultSchema.safeParse({
        awardId: 'a1',
        opened: true,
        grant: progress,
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateAwardGroupGrantResultSchema.safeParse({
        awardId: 'a1',
        opened: false,
        grant: null,
      }).success,
    ).toBe(true);
    const complete = { ...progress, status: 'complete', completedAt: 9, lastError: null };
    expect(AdminGetAwardGroupGrantStatusResultSchema.safeParse({ grant: complete }).success).toBe(
      true,
    );
    expect(AdminGetAwardGroupGrantStatusResultSchema.safeParse({ grant: null }).success).toBe(true);
    const league = { groupType: 'league', groupId: 'l1' };
    expect(
      AdminGetAwardGroupGrantStatusInputSchema.safeParse({ awardId: 'a1', group: league }).success,
    ).toBe(true);
  });
});
