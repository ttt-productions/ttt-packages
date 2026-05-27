import { describe, it, expect } from 'vitest';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  titleSchema,
} from '../src/schemas/atoms';

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

  describe('titleSchema', () => {
    it('accepts a normal title', () => {
      expect(titleSchema.parse('My Tale')).toBe('My Tale');
    });
    it('rejects empty title', () => {
      expect(() => titleSchema.parse('')).toThrow();
    });
    it('rejects title longer than 200 chars', () => {
      expect(() => titleSchema.parse('a'.repeat(201))).toThrow();
    });
    it('accepts exactly 200 chars', () => {
      expect(titleSchema.parse('a'.repeat(200))).toBe('a'.repeat(200));
    });
  });
});


