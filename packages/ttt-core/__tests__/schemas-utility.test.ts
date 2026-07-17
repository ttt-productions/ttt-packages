import { describe, it, expect } from 'vitest';
import {
  SubmitFeedbackInputSchema,
  SubmitContentAppealResultSchema,
  AcceptViolationDecisionResultSchema,
} from '../src/schemas/utility';
import { FEEDBACK_TYPES } from '../src/constants/business';

describe('SubmitFeedbackInputSchema', () => {
  describe('feedbackType (enum)', () => {
    for (const validType of FEEDBACK_TYPES) {
      it(`accepts the canonical feedbackType "${validType}"`, () => {
        const result = SubmitFeedbackInputSchema.safeParse({
          feedbackType: validType,
          suggestion: 'jazz',
        });
        expect(result.success).toBe(true);
      });
    }

    it('rejects an unknown feedbackType', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'arbitraryType',
        suggestion: 'jazz',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty feedbackType', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: '',
        suggestion: 'jazz',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a missing feedbackType', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        suggestion: 'jazz',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('suggestion', () => {
    it('rejects an empty suggestion', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'tradeProfessionSuggestions',
        suggestion: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing spaces', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'tradeProfessionSuggestions',
        suggestion: 'two words',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing uppercase letters', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'tradeProfessionSuggestions',
        suggestion: 'Jazz',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing digits', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'tradeProfessionSuggestions',
        suggestion: 'jazz123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('strict mode', () => {
    it('rejects unknown extra fields', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'tradeProfessionSuggestions',
        suggestion: 'jazz',
        unexpectedField: 'oops',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('moderation result receipts carry an optional auditEventId', () => {
  it('SubmitContentAppealResultSchema parses WITH and WITHOUT auditEventId', () => {
    const base = {
      success: true as const,
      violationId: 'v-1',
      appealStatus: 'pending' as const,
      appealedAt: 1_700_000_000_000,
    };
    expect(SubmitContentAppealResultSchema.parse(base).auditEventId).toBeUndefined();
    expect(SubmitContentAppealResultSchema.parse({ ...base, auditEventId: 'evt-1' }).auditEventId).toBe('evt-1');
  });

  it('AcceptViolationDecisionResultSchema parses WITH and WITHOUT auditEventId', () => {
    const base = { success: true as const, violationId: 'v-1', alreadyRemoved: false };
    expect(AcceptViolationDecisionResultSchema.parse(base).auditEventId).toBeUndefined();
    expect(AcceptViolationDecisionResultSchema.parse({ ...base, auditEventId: 'evt-2' }).auditEventId).toBe('evt-2');
  });
});


