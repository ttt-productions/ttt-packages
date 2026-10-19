import { describe, it, expect } from 'vitest';
import {
  ReviewThresholdItemInputSchema,
  SubmitForThresholdLibraryReviewInputSchema,
} from '../src/schemas/hall-library.js';
import { MAX_HALL_LIBRARY_SUBMIT_BATCH } from '../src/constants/business-admin.js';

const REVIEWER_CHECKLIST = [
  'confirmedNoBegging',
  'confirmedNoCredits',
  'confirmedRealPeopleAttestation',
  'confirmedConsistentFormat',
  'teachesSomething',
] as const;

const SUBMITTER_ATTESTATIONS = [
  'attestConsistentFormat',
  'attestNoCredits',
  'attestNoBegging',
  'attestHumanMadeOriginal',
  'attestPublishStewardship',
] as const;

describe('threshold review input', () => {
  const review = { thresholdItemId: 'ti-1', decision: 'approved' as const };

  it('accepts a decision with every reviewer confirmation given', () => {
    const all = Object.fromEntries(REVIEWER_CHECKLIST.map((field) => [field, true]));
    expect(ReviewThresholdItemInputSchema.parse({ ...review, ...all })).toEqual({ ...review, ...all });
  });

  it('accepts a decision with no confirmations, so a send-back needs none', () => {
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, decision: 'needs_revision' }).success).toBe(true);
  });

  it.each(REVIEWER_CHECKLIST)('accepts %s as null, which the callable client sends for an omitted argument', (field) => {
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, [field]: null }).success).toBe(true);
  });

  it.each(REVIEWER_CHECKLIST)('refuses %s when it is not a boolean', (field) => {
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, [field]: 'yes' }).success).toBe(false);
  });

  it('refuses a missing threshold item and an unknown decision', () => {
    expect(ReviewThresholdItemInputSchema.safeParse({ decision: 'approved' }).success).toBe(false);
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, decision: 'rejected' }).success).toBe(false);
  });

  it('refuses a key the contract does not carry, such as a free-text disclaimer', () => {
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, requiredDisclaimer: 'x' }).success).toBe(false);
    expect(ReviewThresholdItemInputSchema.safeParse({ ...review, extra: true }).success).toBe(false);
  });
});

describe('threshold submit input', () => {
  const submit = {
    workProjectId: 'wp-1',
    workProjectType: 'Tales',
    selectedItemIds: ['ch-1'],
    depictsRealPeople: false,
  };

  it('accepts a submission with every submitter attestation given', () => {
    const all = Object.fromEntries(SUBMITTER_ATTESTATIONS.map((field) => [field, true]));
    expect(SubmitForThresholdLibraryReviewInputSchema.parse({ ...submit, ...all })).toEqual({ ...submit, ...all });
  });

  it('accepts a submission with the attestations missing, leaving the required-true check to the submit core', () => {
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse(submit).success).toBe(true);
  });

  it.each(SUBMITTER_ATTESTATIONS)('accepts %s as null, which the callable client sends for an omitted argument', (field) => {
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, [field]: null }).success).toBe(true);
  });

  it.each(SUBMITTER_ATTESTATIONS)('refuses %s when it is not a boolean', (field) => {
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, [field]: 'yes' }).success).toBe(false);
  });

  it('requires the author to answer whether the Work depicts real people', () => {
    const { depictsRealPeople: _omitted, ...withoutAnswer } = submit;
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse(withoutAnswer).success).toBe(false);
  });

  it('takes the founder-notice acknowledgment only as true', () => {
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, legalReviewNoticeAcknowledged: true }).success).toBe(true);
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, legalReviewNoticeAcknowledged: false }).success).toBe(false);
  });

  it('refuses a missing Work, an unknown Work type, and an empty selection', () => {
    const { workProjectId: _omitted, ...withoutWork } = submit;
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse(withoutWork).success).toBe(false);
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, workProjectType: 'Poems' }).success).toBe(false);
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, selectedItemIds: [] }).success).toBe(false);
  });

  it('takes at most one submit batch of items', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => `ch-${i}`);
    expect(
      SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, selectedItemIds: ids(MAX_HALL_LIBRARY_SUBMIT_BATCH) }).success,
    ).toBe(true);
    expect(
      SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, selectedItemIds: ids(MAX_HALL_LIBRARY_SUBMIT_BATCH + 1) }).success,
    ).toBe(false);
  });

  it('refuses a key the contract does not carry', () => {
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, extra: true }).success).toBe(false);
  });
});
