/**
 * R1 / R3 contract tests (2026-07-12):
 *  - the change-request submit input carries exactly one grain (hall item XOR realm)
 *  - the realm grain's surface + field allowlist/caps exist and match the realm
 *    authoring input caps
 *  - the threshold submit input requires the author real-people attestation
 *  - the ONE standard real-people disclaimer message exists (no free-text anywhere)
 */

import { describe, it, expect } from 'vitest';
import {
  SubmitHallContentChangeRequestInputSchema,
  SubmitForThresholdLibraryReviewInputSchema,
  ReviewThresholdItemInputSchema,
} from '../src/schemas/hall-library';
import {
  HallContentTextSurfaceSchema,
  HallContentChangeRequestSchema,
  ThresholdItemSchema,
  PublishedHallItemSchema,
} from '../src/doc-schemas/content';
import { WorkRealmSchema } from '../src/doc-schemas/work-project';
import {
  HALL_CONTENT_TEXT_FIELDS,
  HALL_CONTENT_TEXT_FIELD_MAX,
  HALL_CONTENT_SURFACES_BY_WORK_TYPE,
  MODERATION_CLEARABLE_TEXT_FIELDS,
  REAL_PEOPLE_DISCLAIMER_HEADER,
  REAL_PEOPLE_DISCLAIMER_MESSAGE,
} from '../src/constants/business-content';
import { CLEARABLE_TEXT_FIELD_LABELS } from '../src/constants/admin-labels';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content';
import {
  MAX_WORK_REALM_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
} from '../src/constants/business-work-project';

describe('SubmitHallContentChangeRequestInputSchema grains', () => {
  const fields = { title: 'New title' };

  it('accepts the hall detail grain (hallItemId + workProjectType)', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      hallItemId: 'hall-1',
      workProjectType: 'Tales',
      proposedFields: fields,
    });
    expect(r.success).toBe(true);
  });

  it('accepts the sub-item grain (hallItemId + workProjectType + subItemId)', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      hallItemId: 'hall-1',
      workProjectType: 'Tales',
      subItemId: 'sub-1',
      proposedFields: fields,
    });
    expect(r.success).toBe(true);
  });

  it('accepts the realm grain (workRealmId only)', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      workRealmId: 'realm-1',
      proposedFields: { workingTitle: 'New realm name' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects both grains at once', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      hallItemId: 'hall-1',
      workProjectType: 'Tales',
      workRealmId: 'realm-1',
      proposedFields: fields,
    });
    expect(r.success).toBe(false);
  });

  it('rejects neither grain', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      proposedFields: fields,
    });
    expect(r.success).toBe(false);
  });

  it('rejects the hall grain without workProjectType', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      hallItemId: 'hall-1',
      proposedFields: fields,
    });
    expect(r.success).toBe(false);
  });

  it('rejects workProjectType on the realm grain', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      workRealmId: 'realm-1',
      workProjectType: 'Tales',
      proposedFields: fields,
    });
    expect(r.success).toBe(false);
  });

  it('rejects subItemId on the realm grain', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      workRealmId: 'realm-1',
      subItemId: 'sub-1',
      proposedFields: fields,
    });
    expect(r.success).toBe(false);
  });

  it('accepts null grain fields as absent (callable wire encodes undefined as null)', () => {
    const r = SubmitHallContentChangeRequestInputSchema.safeParse({
      hallItemId: 'hall-1',
      workProjectType: 'Tales',
      workRealmId: null,
      subItemId: null,
      proposedFields: fields,
    });
    expect(r.success).toBe(true);
  });
});

describe('realm grain surface + allowlist', () => {
  it('workRealm is a valid text surface', () => {
    expect(HallContentTextSurfaceSchema.safeParse('workRealm').success).toBe(true);
  });

  it('realm allowlist targets the realm doc field names', () => {
    expect(HALL_CONTENT_TEXT_FIELDS.workRealm).toEqual(['workingTitle', 'workingDescription']);
  });

  it('realm field caps derive from the owning realm constants (one truth set)', () => {
    expect(HALL_CONTENT_TEXT_FIELD_MAX.workingTitle).toBe(MAX_WORK_REALM_TITLE_LENGTH);
    expect(HALL_CONTENT_TEXT_FIELD_MAX.workingDescription).toBe(MAX_WORK_REALM_DESCRIPTION_LENGTH);
  });

  it('every allowlisted field name has a cap', () => {
    for (const fieldNames of Object.values(HALL_CONTENT_TEXT_FIELDS)) {
      for (const field of fieldNames) {
        expect(HALL_CONTENT_TEXT_FIELD_MAX[field as keyof typeof HALL_CONTENT_TEXT_FIELD_MAX]).toBeTypeOf('number');
      }
    }
  });
});

describe('HALL_CONTENT_SURFACES_BY_WORK_TYPE', () => {
  it('routes every canonical work-project type (completeness)', () => {
    expect(Object.keys(HALL_CONTENT_SURFACES_BY_WORK_TYPE).sort()).toEqual(
      [...WORK_PROJECT_TYPE_KEYS].sort(),
    );
  });

  it('routes each type to its settled detail + sub-item surface identities', () => {
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tales.detailSurface).toBe('tale');
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tales.subItemSurface).toBe('chapter');
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tunes.detailSurface).toBe('tune');
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tunes.subItemSurface).toBe('tuneTrack');
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Television.detailSurface).toBe('television');
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Television.subItemSurface).toBe('televisionEpisode');
  });

  it('every routed surface is a canonical text surface AND a clearable surface', () => {
    for (const routing of Object.values(HALL_CONTENT_SURFACES_BY_WORK_TYPE)) {
      for (const surface of [routing.detailSurface, routing.subItemSurface]) {
        expect(HallContentTextSurfaceSchema.safeParse(surface).success).toBe(true);
        expect(MODERATION_CLEARABLE_TEXT_FIELDS).toHaveProperty(surface);
      }
    }
  });

  it('composes its field tuples from the canonical clearable-field map (no restated literals)', () => {
    for (const routing of Object.values(HALL_CONTENT_SURFACES_BY_WORK_TYPE)) {
      const owner = MODERATION_CLEARABLE_TEXT_FIELDS as Record<string, readonly string[]>;
      expect(routing.detailFields).toBe(owner[routing.detailSurface]);
      expect(routing.subItemFields).toBe(owner[routing.subItemSurface]);
    }
  });

  it('distinguishes the Tale chapter tuple from the track/episode tuple', () => {
    // The failure this guards: the admin picker's old `type === 'Tales' ? chapter : tuneTrack`
    // ternary handed Television the tuneTrack tuple — correct only while the two happen to match.
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tales.subItemFields).toEqual(['title', 'content']);
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tunes.subItemFields).toEqual(['title', 'description']);
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Television.subItemFields).toEqual([
      'title',
      'description',
    ]);
    expect(HALL_CONTENT_SURFACES_BY_WORK_TYPE.Television.subItemFields).not.toBe(
      HALL_CONTENT_SURFACES_BY_WORK_TYPE.Tunes.subItemFields,
    );
  });

  it('every routed field has a cap and a display label', () => {
    for (const routing of Object.values(HALL_CONTENT_SURFACES_BY_WORK_TYPE)) {
      for (const field of [...routing.detailFields, ...routing.subItemFields]) {
        expect(HALL_CONTENT_TEXT_FIELD_MAX[field]).toBeTypeOf('number');
        expect(CLEARABLE_TEXT_FIELD_LABELS[field].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('HallContentChangeRequest doc grains', () => {
  const base = {
    changeRequestId: 'cr-1',
    requestKind: 'text',
    workProjectId: 'wp-1',
    proposerUid: 'uid-1',
    proposedFields: { title: 'x' },
    status: 'requested',
    createdAt: 1,
    lastUpdatedAt: 1,
  };

  it('parses a hall-grain doc', () => {
    const r = HallContentChangeRequestSchema.safeParse({
      ...base,
      targetKey: 'hall-1_detail',
      hallItemId: 'hall-1',
      workProjectType: 'Tales',
      surface: 'tale',
      workRealmId: null,
      subItemId: null,
    });
    expect(r.success).toBe(true);
  });

  it('parses a realm-grain doc', () => {
    const r = HallContentChangeRequestSchema.safeParse({
      ...base,
      targetKey: 'realm_realm-1',
      hallItemId: null,
      workProjectType: null,
      surface: 'workRealm',
      workRealmId: 'realm-1',
      subItemId: null,
      proposedFields: { workingTitle: 'x' },
    });
    expect(r.success).toBe(true);
  });
});

describe('R3 reviewer checklist', () => {
  it('review input accepts the real-people attestation confirmation', () => {
    const r = ReviewThresholdItemInputSchema.safeParse({
      thresholdItemId: 'ti-1',
      decision: 'approved',
      confirmedNoBegging: true,
      confirmedNoCredits: true,
      confirmedRealPeopleAttestation: true,
    });
    expect(r.success).toBe(true);
  });
});

describe('R3 author attestation + standard disclaimer', () => {
  it('threshold submit input requires depictsRealPeople', () => {
    const base = {
      workProjectId: 'wp-1',
      workProjectType: 'Tales',
      selectedItemIds: ['a'],
    };
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse(base).success).toBe(false);
    expect(
      SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...base, depictsRealPeople: false }).success,
    ).toBe(true);
    expect(
      SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...base, depictsRealPeople: true }).success,
    ).toBe(true);
  });

  it('ThresholdItem requires hasRealPeople and carries no free-text disclaimer', () => {
    expect(ThresholdItemSchema.shape.hasRealPeople.isOptional()).toBe(false);
    expect('requiredDisclaimer' in ThresholdItemSchema.shape).toBe(false);
  });

  it('PublishedHallItem carries no free-text disclaimer', () => {
    expect('requiredDisclaimer' in PublishedHallItemSchema.shape).toBe(false);
  });

  it('the ONE standard disclaimer exists: playbill header + legal message', () => {
    expect(REAL_PEOPLE_DISCLAIMER_HEADER).toContain('Notice from the Management');
    expect(REAL_PEOPLE_DISCLAIMER_MESSAGE).toContain('parody');
    expect(REAL_PEOPLE_DISCLAIMER_MESSAGE.length).toBeGreaterThan(100);
    // The legal message must HEDGE, never admit depiction (the load-bearing move).
    expect(REAL_PEOPLE_DISCLAIMER_MESSAGE).toContain('even those based on real people');
    expect(REAL_PEOPLE_DISCLAIMER_MESSAGE.startsWith('This work depicts')).toBe(false);
  });
});

describe('WorkRealm monotonic publish lock', () => {
  it('accepts hasEverPublishedWork as an optional backend flag', () => {
    const base = {
      workRealmId: 'r1',
      realmType: 'public',
      realmStatus: 'draft',
      realmHidden: false,
      workingTitle: 't',
      workingTitle_lowercase: 't',
      workingDescription: 'd',
      workStewardUid: 'u1',
      foundingArtisanUid: 'u1',
      foundingWorkProjectId: 'wp-1',
      createdOn: 1,
      updatedOn: 1,
    };
    expect(WorkRealmSchema.safeParse(base).success).toBe(true);
    expect(WorkRealmSchema.safeParse({ ...base, hasEverPublishedWork: true }).success).toBe(true);
  });
});
