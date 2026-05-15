import { describe, it, expect } from 'vitest';
import { SubmitFeedbackInputSchema } from '../src/schemas/utility';
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
        feedbackType: 'professionSuggestions',
        suggestion: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing spaces', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'professionSuggestions',
        suggestion: 'two words',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing uppercase letters', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'professionSuggestions',
        suggestion: 'Jazz',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a suggestion containing digits', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'professionSuggestions',
        suggestion: 'jazz123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('strict mode', () => {
    it('rejects unknown extra fields', () => {
      const result = SubmitFeedbackInputSchema.safeParse({
        feedbackType: 'professionSuggestions',
        suggestion: 'jazz',
        unexpectedField: 'oops',
      });
      expect(result.success).toBe(false);
    });
  });
});
