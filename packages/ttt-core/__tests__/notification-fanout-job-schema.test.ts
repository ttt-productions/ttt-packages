import { describe, it, expect } from 'vitest';
import {
  NotificationFanoutJobSchema,
  NotificationFanoutPhaseSchema,
  NotificationFanoutPhaseSelectorSchema,
} from '../src/doc-schemas/notification-ledger.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';

// A fanout job drains each phase's selector into recipients. A malformed selector, cursor, or
// phase must be refused where the row is written and read, never drained to zero recipients.

const validSelectorByKind: Record<string, Record<string, unknown>> = {
  workFollowers: { kind: 'workFollowers', workProjectId: 'w1' },
  realmFollowers: { kind: 'realmFollowers', workRealmId: 'r1' },
  userFollowers: { kind: 'userFollowers', artisanUid: 'u1' },
  workGuildMembers: { kind: 'workGuildMembers', workProjectId: 'w1' },
  realmMembers: { kind: 'realmMembers', workRealmId: 'r1' },
  workMembers: { kind: 'workMembers', memberUids: ['u1', 'u2'] },
  userFollowersMany: { kind: 'userFollowersMany', memberUids: ['u1'] },
  explicitUids: { kind: 'explicitUids', uids: ['u1', 'u2', 'u3'] },
  allArtisans: { kind: 'allArtisans' },
  allActiveUsers: { kind: 'allActiveUsers' },
};

const requiredArgByKind: Record<string, string | null> = {
  workFollowers: 'workProjectId',
  realmFollowers: 'workRealmId',
  userFollowers: 'artisanUid',
  workGuildMembers: 'workProjectId',
  realmMembers: 'workRealmId',
  workMembers: 'memberUids',
  userFollowersMany: 'memberUids',
  explicitUids: 'uids',
  allArtisans: null,
  allActiveUsers: null,
};

describe('a fanout phase selector carries exactly the arguments its kind needs', () => {
  for (const [kind, valid] of Object.entries(validSelectorByKind)) {
    it(`accepts a ${kind} selector with its arguments`, () => {
      expect(NotificationFanoutPhaseSelectorSchema.safeParse(valid).success).toBe(true);
    });

    const requiredArg = requiredArgByKind[kind];
    if (requiredArg !== null) {
      it(`refuses a ${kind} selector missing ${requiredArg}`, () => {
        const { [requiredArg]: _omitted, ...withoutArg } = valid;
        expect(NotificationFanoutPhaseSelectorSchema.safeParse(withoutArg).success).toBe(false);
      });
    }
  }

  it('refuses a target-id selector whose target id is empty', () => {
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'workFollowers', workProjectId: '' })
        .success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'realmFollowers', workRealmId: '' })
        .success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'userFollowers', artisanUid: '' })
        .success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({
        kind: 'workGuildMembers',
        workProjectId: '',
      }).success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'realmMembers', workRealmId: '' })
        .success,
    ).toBe(false);
  });

  it('refuses a list selector whose list is not a list of uid strings', () => {
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'workMembers', memberUids: 'u1' })
        .success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({
        kind: 'userFollowersMany',
        memberUids: [1, 2],
      }).success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'explicitUids', uids: [{}] }).success,
    ).toBe(false);
  });

  it('refuses an unknown selector kind and a selector with no kind', () => {
    expect(
      NotificationFanoutPhaseSelectorSchema.safeParse({
        kind: 'somethingElse',
        workProjectId: 'w1',
      }).success,
    ).toBe(false);
    expect(NotificationFanoutPhaseSelectorSchema.safeParse({ kind: 'allFollowers' }).success).toBe(
      false,
    );
    expect(NotificationFanoutPhaseSelectorSchema.safeParse({}).success).toBe(false);
  });
});

describe("a fanout phase stores its cursor in its selector kind's shape", () => {
  const validCursorByKind: Record<string, unknown> = {
    workFollowers: 'edge-doc-1',
    realmFollowers: 'edge-doc-1',
    userFollowers: 'edge-doc-1',
    workGuildMembers: 'member-doc-1',
    allActiveUsers: 'projection-doc-1',
    workMembers: 5,
    explicitUids: 0,
    userFollowersMany: { memberGroupIndex: 1, lastEdgeDocId: 'edge-doc-1' },
    realmMembers: { workId: 'w1', workCursor: 'wc1', memberCursor: 'mc1' },
    allArtisans: JSON.stringify({ artisanCreator: 1, uid: 'u1' }),
  };

  const wrongCursorByKind: Record<string, unknown> = {
    workFollowers: 5,
    realmFollowers: 5,
    userFollowers: { foo: 'bar' },
    workGuildMembers: 12,
    allActiveUsers: 99,
    workMembers: 'not-a-number',
    explicitUids: -1,
    userFollowersMany: 'edge-doc-1',
    realmMembers: 'edge-doc-1',
    allArtisans: JSON.stringify({ notArtisanCreator: true }),
  };

  for (const [kind, selector] of Object.entries(validSelectorByKind)) {
    it(`accepts a ${kind} phase with its cursor shape`, () => {
      expect(
        NotificationFanoutPhaseSchema.safeParse({
          selector,
          cursor: validCursorByKind[kind],
          done: false,
        }).success,
      ).toBe(true);
    });

    it(`accepts a ${kind} phase with a null cursor`, () => {
      expect(
        NotificationFanoutPhaseSchema.safeParse({ selector, cursor: null, done: false }).success,
      ).toBe(true);
    });

    it(`refuses a ${kind} phase whose cursor has another kind's shape`, () => {
      expect(
        NotificationFanoutPhaseSchema.safeParse({
          selector,
          cursor: wrongCursorByKind[kind],
          done: false,
        }).success,
      ).toBe(false);
    });
  }

  it('refuses an allArtisans cursor that is not JSON', () => {
    expect(
      NotificationFanoutPhaseSchema.safeParse({
        selector: { kind: 'allArtisans' },
        cursor: 'not json at all',
        done: false,
      }).success,
    ).toBe(false);
  });

  it('refuses a userFollowersMany cursor missing memberGroupIndex', () => {
    expect(
      NotificationFanoutPhaseSchema.safeParse({
        selector: { kind: 'userFollowersMany', memberUids: ['u1'] },
        cursor: { lastEdgeDocId: 'edge-doc-1' },
        done: false,
      }).success,
    ).toBe(false);
  });

  it('refuses a realmMembers cursor with a non-string field', () => {
    expect(
      NotificationFanoutPhaseSchema.safeParse({
        selector: { kind: 'realmMembers', workRealmId: 'r1' },
        cursor: { workId: 1, workCursor: 'wc1', memberCursor: 'mc1' },
        done: false,
      }).success,
    ).toBe(false);
  });

  it('refuses a phase missing its cursor or its done flag', () => {
    expect(
      NotificationFanoutPhaseSchema.safeParse({ selector: { kind: 'allActiveUsers' }, done: false })
        .success,
    ).toBe(false);
    expect(
      NotificationFanoutPhaseSchema.safeParse({
        selector: { kind: 'allActiveUsers' },
        cursor: null,
      }).success,
    ).toBe(false);
  });
});

describe('the stored notificationFanoutJobs row', () => {
  function makeJob(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      jobId: 'evt-1:followed_content_published',
      schemaVersion: 1,
      notificationType: 'followed_content_published',
      eventId: 'evt-1',
      priority: 2,
      payload: { hallItemId: 'h1' },
      phases: [
        { selector: { kind: 'workFollowers', workProjectId: 'w1' }, cursor: null, done: false },
        { selector: { kind: 'allActiveUsers' }, cursor: null, done: false },
      ],
      phaseIndex: 0,
      revision: 0,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: 0,
      lastError: null,
      createdAt: 0,
      updatedAt: 0,
      completedAt: null,
      deadLetteredAt: null,
      ...over,
    };
  }

  it('is the schema the registry binds to notificationFanoutJobs/{jobId}', () => {
    expect(COLLECTION_SCHEMAS['notificationFanoutJobs/{jobId}']).toBe(NotificationFanoutJobSchema);
  });

  it('accepts a row whose phaseIndex names an existing phase', () => {
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ phaseIndex: 0 })).success).toBe(true);
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ phaseIndex: 1 })).success).toBe(true);
  });

  it('refuses a row whose phaseIndex is past the last phase', () => {
    const result = NotificationFanoutJobSchema.safeParse(makeJob({ phaseIndex: 2 }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'phaseIndex')).toBe(true);
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ phaseIndex: 7 })).success).toBe(false);
  });

  it('refuses a negative or fractional phaseIndex, revision, or attemptCount', () => {
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ phaseIndex: -1 })).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ revision: 0.5 })).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ attemptCount: -1 })).success).toBe(
      false,
    );
  });

  it('refuses a row with no phases', () => {
    expect(
      NotificationFanoutJobSchema.safeParse(makeJob({ phases: [], phaseIndex: 0 })).success,
    ).toBe(false);
  });

  it('refuses a row with an unknown selector kind in a phase', () => {
    expect(
      NotificationFanoutJobSchema.safeParse(
        makeJob({
          phases: [{ selector: { kind: 'mysterySelector' }, cursor: null, done: false }],
        }),
      ).success,
    ).toBe(false);
  });

  it('refuses a row with an empty jobId, notificationType, or eventId', () => {
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ jobId: '' })).success).toBe(false);
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ notificationType: '' })).success).toBe(
      false,
    );
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ eventId: '' })).success).toBe(false);
  });

  it('refuses a priority outside the declared tiers', () => {
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ priority: 3 })).success).toBe(false);
  });

  it('refuses a status outside pending, complete, and deadLetter', () => {
    expect(NotificationFanoutJobSchema.safeParse(makeJob({ status: 'parked' })).success).toBe(
      false,
    );
  });

  it('refuses a row missing deadLetteredAt', () => {
    const { deadLetteredAt: _omitted, ...withoutDeadLetteredAt } = makeJob();
    expect(NotificationFanoutJobSchema.safeParse(withoutDeadLetteredAt).success).toBe(false);
  });

  for (const field of ['schemaVersion', 'lastError', 'updatedAt', 'completedAt'] as const) {
    it(`refuses a row missing ${field}`, () => {
      const { [field]: _omitted, ...without } = makeJob();
      expect(NotificationFanoutJobSchema.safeParse(without).success).toBe(false);
    });
  }

  it('accepts a completed row carrying its TTL stamp', () => {
    expect(
      NotificationFanoutJobSchema.safeParse(
        makeJob({
          status: 'complete',
          completedAt: 5,
          expireAt: { seconds: 1, nanoseconds: 0 },
        }),
      ).success,
    ).toBe(true);
  });

  it('accepts a dead-lettered row with its dead-letter time', () => {
    expect(
      NotificationFanoutJobSchema.safeParse(
        makeJob({
          status: 'deadLetter',
          deadLetteredAt: 9,
          lastError: 'selector failed',
        }),
      ).success,
    ).toBe(true);
  });
});
