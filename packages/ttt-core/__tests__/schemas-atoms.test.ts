import { describe, it, expect } from 'vitest';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  moderationClearableSurfaceSchema,
  titleSchema,
} from '../src/schemas/atoms';
import { MAX_WORK_PROJECT_TITLE_LENGTH } from '../src/constants/business';
import { MODERATION_CLEARABLE_TEXT_FIELDS } from '../src/constants/business-content';

describe('atom schemas', () => {
  describe('workProjectIdSchema', () => {
    it('accepts a non-empty string', () => {
      expect(workProjectIdSchema.parse('proj-123')).toBe('proj-123');
    });
    it('rejects empty string', () => {
      expect(() => workProjectIdSchema.parse('')).toThrow();
    });
    it('rejects non-string', () => {
      expect(() => workProjectIdSchema.parse(123)).toThrow();
      expect(() => workProjectIdSchema.parse(null)).toThrow();
      expect(() => workProjectIdSchema.parse(undefined)).toThrow();
    });
  });

  describe('userIdSchema', () => {
    it('accepts a non-empty string', () => {
      expect(userIdSchema.parse('user-123')).toBe('user-123');
    });
    it('rejects empty string', () => {
      expect(() => userIdSchema.parse('')).toThrow();
    });
  });

  describe('addRemoveActionSchema', () => {
    it("accepts 'add'", () => {
      expect(addRemoveActionSchema.parse('add')).toBe('add');
    });
    it("accepts 'remove'", () => {
      expect(addRemoveActionSchema.parse('remove')).toBe('remove');
    });
    it('rejects other values', () => {
      expect(() => addRemoveActionSchema.parse('delete')).toThrow();
      expect(() => addRemoveActionSchema.parse('')).toThrow();
    });
  });

  describe('workProjectTypeSchema', () => {
    it('accepts the three valid types', () => {
      expect(workProjectTypeSchema.parse('Tales')).toBe('Tales');
      expect(workProjectTypeSchema.parse('Tunes')).toBe('Tunes');
      expect(workProjectTypeSchema.parse('Television')).toBe('Television');
    });
    it('rejects lowercase or other values', () => {
      expect(() => workProjectTypeSchema.parse('tales')).toThrow();
      expect(() => workProjectTypeSchema.parse('Music')).toThrow();
    });
  });

  describe('moderationClearableSurfaceSchema', () => {
    const surfaces = Object.keys(MODERATION_CLEARABLE_TEXT_FIELDS);

    it('accepts every key of the canonical clearable-fields map', () => {
      for (const surface of surfaces) {
        expect(moderationClearableSurfaceSchema.parse(surface)).toBe(surface);
      }
    });

    it('enumerates EXACTLY the canonical map keys — derived, never a hand-listed copy', () => {
      expect([...moderationClearableSurfaceSchema.options].sort()).toEqual([...surfaces].sort());
    });

    it('every accepted surface indexes a non-empty clearable field tuple', () => {
      // The whole point of the atom: a consumer can index the field map with a parsed value.
      for (const surface of moderationClearableSurfaceSchema.options) {
        expect(MODERATION_CLEARABLE_TEXT_FIELDS[surface].length).toBeGreaterThan(0);
      }
    });

    it('rejects a non-surface, a work-project type, and a bare field name', () => {
      expect(() => moderationClearableSurfaceSchema.parse('squarePost')).toThrow();
      expect(() => moderationClearableSurfaceSchema.parse('Tales')).toThrow();
      expect(() => moderationClearableSurfaceSchema.parse('title')).toThrow();
      expect(() => moderationClearableSurfaceSchema.parse('')).toThrow();
      expect(() => moderationClearableSurfaceSchema.parse(null)).toThrow();
    });
  });

  describe('titleSchema', () => {
    it('accepts a normal title', () => {
      expect(titleSchema.parse('My Tale')).toBe('My Tale');
    });
    it('rejects empty title', () => {
      expect(() => titleSchema.parse('')).toThrow();
    });
    it('rejects title longer than MAX_WORK_PROJECT_TITLE_LENGTH', () => {
      expect(() => titleSchema.parse('a'.repeat(MAX_WORK_PROJECT_TITLE_LENGTH + 1))).toThrow();
    });
    it('accepts exactly MAX_WORK_PROJECT_TITLE_LENGTH chars', () => {
      expect(titleSchema.parse('a'.repeat(MAX_WORK_PROJECT_TITLE_LENGTH))).toBe(
        'a'.repeat(MAX_WORK_PROJECT_TITLE_LENGTH),
      );
    });
  });
});


