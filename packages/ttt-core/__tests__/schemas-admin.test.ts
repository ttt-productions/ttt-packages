import { describe, it, expect } from 'vitest';
import {
  UpdateAdminListInputSchema,
  RestoreWorkProjectInputSchema,
  RestoreWorkRealmInputSchema,
  ReviewContentAppealResultSchema,
  UpdateAdminListResultSchema,
  StagedActionSchema,
  GetReportedContentDetailResultSchema,
  UpdateAppConfigInputSchema,
} from '../src/schemas/admin.js';
import { AppConfigSchema } from '../src/doc-schemas/system.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  HALL_CLEARABLE_TEXT_FIELD_NAMES,
  HALL_CONTENT_SURFACES_BY_WORK_TYPE,
} from '../src/constants/business-content.js';
import { MAX_ANNOUNCEMENT_MESSAGE_LENGTH } from '../src/constants/business-admin.js';

describe('announcementMessage — the third operational lever on _config/app', () => {
  const baseConfig = {
    appVersion: '1.0.0',
    maintenanceMode: false,
    registrationEnabled: true,
  };

  it('is OPTIONAL on the doc schema — an existing config doc still parses', () => {
    expect(AppConfigSchema.safeParse(baseConfig).success).toBe(true);
  });

  it('accepts announcement copy, and EMPTY (no banner) is a valid stored value', () => {
    expect(AppConfigSchema.safeParse({ ...baseConfig, announcementMessage: 'Back at 9pm ET.' }).success).toBe(true);
    // Empty = no banner. There is no separate on/off boolean, so clearing the text IS the off state.
    expect(AppConfigSchema.safeParse({ ...baseConfig, announcementMessage: '' }).success).toBe(true);
  });

  it('caps the banner copy at the canonical length on BOTH the doc and the callable input', () => {
    const tooLong = 'a'.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH + 1);
    const atCap = 'a'.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH);
    expect(AppConfigSchema.safeParse({ ...baseConfig, announcementMessage: atCap }).success).toBe(true);
    expect(AppConfigSchema.safeParse({ ...baseConfig, announcementMessage: tooLong }).success).toBe(false);
    expect(
      UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { announcementMessage: atCap } }).success,
    ).toBe(true);
    expect(
      UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { announcementMessage: tooLong } }).success,
    ).toBe(false);
  });

  it('is writable on its own through updateAppConfig — the lever is independent of the others', () => {
    const parsed = UpdateAppConfigInputSchema.parse({ docId: 'app', data: { announcementMessage: '' } });
    expect(parsed.data.announcementMessage).toBe('');
    expect(parsed.data.maintenanceMode).toBeUndefined();
    expect(parsed.data.registrationEnabled).toBeUndefined();
  });

  it('rejects a non-string announcement (the input stays .strict())', () => {
    expect(
      UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { announcementMessage: true } }).success,
    ).toBe(false);
    expect(
      UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { announcementBanner: 'x' } }).success,
    ).toBe(false);
  });
});

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

describe('GetReportedContentDetailResultSchema — resolved clearableSurface', () => {
  const base = {
    itemType: 'hall-library-sub-item',
    reportedItemId: 'chapter-1',
    textSnapshot: null,
    textFields: [],
    mediaAssets: [],
    isHidden: null,
    ownerUid: null,
    reportTimeSnapshot: null,
  };

  it('carries a resolved hall sub-item surface', () => {
    const parsed = GetReportedContentDetailResultSchema.parse({
      ...base,
      clearableSurface: HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tales.subItemSurface,
    });
    expect(parsed.clearableSurface).toBe('chapter');
  });

  it('is additive — a payload produced before the field existed still parses', () => {
    expect(GetReportedContentDetailResultSchema.parse(base).clearableSurface).toBeUndefined();
  });

  it('accepts null for a reported item that is not a clearable text surface', () => {
    const parsed = GetReportedContentDetailResultSchema.parse({
      ...base,
      itemType: 'square-streetz-post',
      clearableSurface: null,
    });
    expect(parsed.clearableSurface).toBeNull();
  });

  it('rejects a value that is not a canonical clearable surface', () => {
    for (const bad of ['Tales', 'hall-library-sub-item', 'title', 'squarePost', '']) {
      expect(GetReportedContentDetailResultSchema.safeParse({ ...base, clearableSurface: bad }).success).toBe(false);
    }
  });

  it('closes the hole: each hall sub-item surface offers FEWER fields than the hall-family union', () => {
    // The bug this field exists to fix — the picker offered title/description/content to every
    // sub-item, so `description` on a Tale chapter (title/content) and `content` on a Tune track
    // (title/description) passed the wire and were then silently dropped by the clear runner.
    for (const routing of Object.values(HALL_CONTENT_SURFACES_BY_WORK_TYPE)) {
      const surfaceFields = MODERATION_CLEARABLE_TEXT_FIELDS[routing.subItemSurface];
      expect(surfaceFields.length).toBeLessThan(HALL_CLEARABLE_TEXT_FIELD_NAMES.length);
      // Every offered field is a real member of the union (no picker can invent one).
      for (const field of surfaceFields) {
        expect(HALL_CLEARABLE_TEXT_FIELD_NAMES).toContain(field);
      }
      // At least one union member is NOT valid for this surface — i.e. the union genuinely
      // over-offers and resolving the surface is what narrows it.
      expect(
        HALL_CLEARABLE_TEXT_FIELD_NAMES.some((field) => !(surfaceFields as readonly string[]).includes(field)),
      ).toBe(true);
    }
  });

  it('a resolved surface indexes the exact field set the picker must offer', () => {
    expect(MODERATION_CLEARABLE_TEXT_FIELDS[HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tales.subItemSurface]).toEqual([
      'title',
      'content',
    ]);
    expect(MODERATION_CLEARABLE_TEXT_FIELDS[HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tunes.subItemSurface]).toEqual([
      'title',
      'description',
    ]);
    expect(
      MODERATION_CLEARABLE_TEXT_FIELDS[HALL_CONTENT_SURFACES_BY_WORK_TYPE.Television.subItemSurface],
    ).toEqual(['title', 'description']);
  });
});
