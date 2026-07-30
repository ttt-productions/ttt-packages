import { describe, it, expect } from 'vitest';
import {
  UpdateAdminListInputSchema,
  RestoreWorkProjectInputSchema,
  RestoreWorkRealmInputSchema,
  ReviewContentAppealResultSchema,
  UpdateAdminListResultSchema,
  StagedActionSchema,
} from '../src/schemas/admin.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  HALL_CLEARABLE_TEXT_FIELD_NAMES,
} from '../src/constants/business-content.js';

describe('UpdateAdminListInputSchema', () => {
  it('accepts a single addAdmins entry', () => {
    const parsed = UpdateAdminListInputSchema.parse({ addAdmins: ['uid-1'] });
    expect(parsed.addAdmins).toEqual(['uid-1']);
  });

  it('accepts all four fields together', () => {
    const parsed = UpdateAdminListInputSchema.parse({
      addAdmins: ['a1'],
      removeAdmins: ['a2'],
      addJrAdmins: ['j1'],
      removeJrAdmins: ['j2'],
    });
    expect(parsed).toEqual({
      addAdmins: ['a1'],
      removeAdmins: ['a2'],
      addJrAdmins: ['j1'],
      removeJrAdmins: ['j2'],
    });
  });

  it('rejects empty input (all four fields missing or empty)', () => {
    expect(() => UpdateAdminListInputSchema.parse({})).toThrow();
    expect(() =>
      UpdateAdminListInputSchema.parse({
        addAdmins: [],
        removeAdmins: [],
        addJrAdmins: [],
        removeJrAdmins: [],
      }),
    ).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() =>
      UpdateAdminListInputSchema.parse({ addAdmins: ['uid-1'], extra: 'nope' } as unknown),
    ).toThrow();
  });

  it('rejects an empty-string UID', () => {
    expect(() => UpdateAdminListInputSchema.parse({ addAdmins: [''] })).toThrow();
  });

  it('rejects an over-length UID (>128 chars)', () => {
    const longUid = 'a'.repeat(129);
    expect(() => UpdateAdminListInputSchema.parse({ addAdmins: [longUid] })).toThrow();
  });
});

describe('Restore*InputSchema — optional cascadeId', () => {
  it('RestoreWorkProjectInputSchema parses with cascadeId', () => {
    const parsed = RestoreWorkProjectInputSchema.parse({ workProjectId: 'wp-1', cascadeId: 'c-1' });
    expect(parsed).toEqual({ workProjectId: 'wp-1', cascadeId: 'c-1' });
  });

  it('RestoreWorkProjectInputSchema parses WITHOUT cascadeId (derive-all-active contract)', () => {
    const parsed = RestoreWorkProjectInputSchema.parse({ workProjectId: 'wp-1' });
    expect(parsed).toEqual({ workProjectId: 'wp-1' });
    expect(parsed.cascadeId).toBeUndefined();
  });

  it('RestoreWorkProjectInputSchema still rejects an empty-string cascadeId when supplied', () => {
    expect(() =>
      RestoreWorkProjectInputSchema.parse({ workProjectId: 'wp-1', cascadeId: '' }),
    ).toThrow();
  });

  it('RestoreWorkRealmInputSchema parses with and without cascadeId', () => {
    expect(RestoreWorkRealmInputSchema.parse({ workRealmId: 'wr-1', cascadeId: 'c-1' })).toEqual({
      workRealmId: 'wr-1',
      cascadeId: 'c-1',
    });
    expect(RestoreWorkRealmInputSchema.parse({ workRealmId: 'wr-1' })).toEqual({ workRealmId: 'wr-1' });
  });

  it('RestoreWorkRealmInputSchema still rejects an empty-string cascadeId when supplied', () => {
    expect(() => RestoreWorkRealmInputSchema.parse({ workRealmId: 'wr-1', cascadeId: '' })).toThrow();
  });

  it('both reject unknown fields (strict)', () => {
    expect(() =>
      RestoreWorkProjectInputSchema.parse({ workProjectId: 'wp-1', extra: 'nope' } as unknown),
    ).toThrow();
    expect(() =>
      RestoreWorkRealmInputSchema.parse({ workRealmId: 'wr-1', extra: 'nope' } as unknown),
    ).toThrow();
  });
});

describe('StagedActionSchema — clearContentText arm (in-flow clear-content disposition)', () => {
  const [shellTitle, shellDescription] = MODERATION_CLEARABLE_TEXT_FIELDS.workProject;
  const [hallTitle, hallDescription, hallContent] = HALL_CLEARABLE_TEXT_FIELD_NAMES;

  it('accepts a work-project clear naming the shell fields', () => {
    const parsed = StagedActionSchema.parse({
      button: 'clearContentText',
      targetType: 'work-project',
      reportedItemId: 'wp-1',
      fields: [shellTitle, shellDescription],
    });
    expect(parsed).toEqual({
      button: 'clearContentText',
      targetType: 'work-project',
      reportedItemId: 'wp-1',
      fields: [shellTitle, shellDescription],
    });
  });

  it('accepts a work-realm clear naming a single shell field (no parentItemId)', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'work-realm',
        reportedItemId: 'wr-1',
        fields: [shellTitle],
      }).success,
    ).toBe(true);
  });

  it('accepts a hall sub-item clear with its parent hall item id (description AND chapter content)', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'hall-library-sub-item',
        reportedItemId: 'sub-1',
        parentItemId: 'hall-1',
        fields: [hallTitle, hallDescription],
      }).success,
    ).toBe(true);
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'hall-library-sub-item',
        reportedItemId: 'chapter-1',
        parentItemId: 'hall-1',
        fields: [hallTitle, hallContent],
      }).success,
    ).toBe(true);
  });

  it('rejects a cross-target field in either direction (path fields)', () => {
    const hallFieldOnShell = StagedActionSchema.safeParse({
      button: 'clearContentText',
      targetType: 'work-project',
      reportedItemId: 'wp-1',
      fields: [hallTitle],
    });
    expect(hallFieldOnShell.success).toBe(false);
    if (!hallFieldOnShell.success) {
      expect(hallFieldOnShell.error.issues.some((issue) => issue.path[0] === 'fields')).toBe(true);
    }

    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'hall-library-sub-item',
        reportedItemId: 'sub-1',
        parentItemId: 'hall-1',
        fields: [shellTitle],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty fields array', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'work-project',
        reportedItemId: 'wp-1',
        fields: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a hall sub-item clear with no parentItemId (path parentItemId)', () => {
    const result = StagedActionSchema.safeParse({
      button: 'clearContentText',
      targetType: 'hall-library-sub-item',
      reportedItemId: 'sub-1',
      fields: [hallTitle],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'parentItemId')).toBe(true);
    }
  });

  it('rejects unknown keys (strict) — including workProjectType, which is server-read, never on the wire', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'hall-library-sub-item',
        reportedItemId: 'sub-1',
        parentItemId: 'hall-1',
        fields: [hallTitle],
        workProjectType: 'tale',
      }).success,
    ).toBe(false);
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'work-project',
        reportedItemId: 'wp-1',
        fields: [shellTitle],
        reason: 'not on this arm',
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported target type and an empty reportedItemId', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'hall-library-item',
        reportedItemId: 'hall-1',
        fields: [hallTitle],
      }).success,
    ).toBe(false);
    expect(
      StagedActionSchema.safeParse({
        button: 'clearContentText',
        targetType: 'work-project',
        reportedItemId: '',
        fields: [shellTitle],
      }).success,
    ).toBe(false);
  });

  it('leaves sibling arms unaffected by the refinement', () => {
    expect(
      StagedActionSchema.safeParse({
        button: 'forceRetitle',
        targetType: 'work-project',
        reportedItemId: 'wp-1',
      }).success,
    ).toBe(true);
    expect(
      StagedActionSchema.safeParse({
        button: 'hideContent',
        targetType: 'hall-library-sub-item',
        reportedItemId: 'sub-1',
        parentItemId: 'hall-1',
      }).success,
    ).toBe(true);
  });
});

describe('sensitive-action result receipts carry an optional auditEventId', () => {
  it('ReviewContentAppealResultSchema parses WITH and WITHOUT auditEventId', () => {
    const base = { success: true as const, violationId: 'v-1', decision: 'approved' as const, userId: 'u-1' };
    expect(ReviewContentAppealResultSchema.parse(base).auditEventId).toBeUndefined();
    const withId = ReviewContentAppealResultSchema.parse({ ...base, auditEventId: 'evt-9' });
    expect(withId.auditEventId).toBe('evt-9');
  });

  it('UpdateAdminListResultSchema parses WITH and WITHOUT auditEventId', () => {
    const base = {
      success: true as const,
      adminsGranted: 1,
      adminsRevoked: 0,
      jrAdminsGranted: 0,
      jrAdminsRevoked: 0,
    };
    expect(UpdateAdminListResultSchema.parse(base).auditEventId).toBeUndefined();
    expect(UpdateAdminListResultSchema.parse({ ...base, auditEventId: 'evt-7' }).auditEventId).toBe('evt-7');
  });

  it('rejects an empty-string auditEventId when supplied', () => {
    expect(() =>
      ReviewContentAppealResultSchema.parse({
        success: true,
        violationId: 'v-1',
        decision: 'denied',
        userId: 'u-1',
        auditEventId: '',
      }),
    ).toThrow();
  });
});
