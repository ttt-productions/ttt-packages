import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { checkInputFormat, defineInputFormat, type InputFormatSpec } from '@ttt-productions/input-format-core';
import {
  CheckoutTaskRequestSchema,
  createCheckinTaskRequestSchema,
  ReleaseTaskRequestSchema,
  createSubmitReportRequestSchema,
} from '../src/schemas/index';

// Stands in for the consuming app's field-schema builder over a declaration: trim, then the check.
function textField(spec: InputFormatSpec) {
  return z.string().transform((text, ctx) => {
    const result = checkInputFormat(text, spec);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.issue });
      return z.NEVER;
    }
    return result.value;
  });
}

const RESOLUTION = defineInputFormat({ format: 'none', min: 0, max: 2000 });
const COMMENT = defineInputFormat({ format: 'none', min: 1, max: 1000 });

describe('CheckoutTaskRequestSchema', () => {
  it('accepts taskType only', () => {
    const r = { taskType: 'profilePicture' };
    expect(CheckoutTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('accepts taskType + specificTaskId', () => {
    const r = { taskType: 'profilePicture', specificTaskId: 'task-1' };
    expect(CheckoutTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('rejects empty taskType', () => {
    expect(() => CheckoutTaskRequestSchema.parse({ taskType: '' })).toThrow();
  });
  it('rejects unknown keys', () => {
    expect(() =>
      CheckoutTaskRequestSchema.parse({ taskType: 'x', extraField: true }),
    ).toThrow();
  });
});

describe('createCheckinTaskRequestSchema', () => {
  const schema = createCheckinTaskRequestSchema({ resolution: textField(RESOLUTION).optional() });

  it('accepts a resolved checkin and keeps the resolution trimmed', () => {
    expect(schema.parse({ taskId: 'task-1', resolved: true, resolution: '  Cleared profanity  ' })).toEqual({
      taskId: 'task-1',
      resolved: true,
      resolution: 'Cleared profanity',
    });
  });
  it('accepts a checkin without resolution text when the field is optional', () => {
    const r = { taskId: 'task-1', resolved: false };
    expect(schema.parse(r)).toEqual(r);
  });
  it('rejects missing resolved field', () => {
    expect(() => schema.parse({ taskId: 'task-1' })).toThrow();
  });
  it("takes the resolution's bound from the consumer's field schema, not from the package", () => {
    expect(() => schema.parse({ taskId: 'task-1', resolved: true, resolution: 'a'.repeat(2001) })).toThrow();
    const wider = createCheckinTaskRequestSchema({
      resolution: textField(defineInputFormat({ format: 'none', min: 0, max: 5000 })).optional(),
    });
    expect(wider.parse({ taskId: 'task-1', resolved: true, resolution: 'a'.repeat(4500) }).resolution).toHaveLength(4500);
  });
  it('rejects unknown keys', () => {
    expect(() => schema.parse({ taskId: 'task-1', resolved: true, extra: 1 })).toThrow();
  });
});

describe('ReleaseTaskRequestSchema', () => {
  it('accepts a valid release', () => {
    const r = { taskId: 'task-1' };
    expect(ReleaseTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('rejects empty taskId', () => {
    expect(() => ReleaseTaskRequestSchema.parse({ taskId: '' })).toThrow();
  });
  it('rejects unknown keys', () => {
    expect(() =>
      ReleaseTaskRequestSchema.parse({ taskId: 't-1', force: true }),
    ).toThrow();
  });
});

describe('createSubmitReportRequestSchema', () => {
  const schema = createSubmitReportRequestSchema({ comment: textField(COMMENT) });
  const minimal = {
    itemType: 'squareStreetzPost',
    reportedItemId: 'item-1',
    reason: 'Spam or Misleading',
    comment: 'Extra detail',
  };

  it('accepts a request with all optional fields populated', () => {
    const full = { ...minimal, parentItemId: 'parent-1', reportedUserId: 'user-2', confirmUpgrade: true };
    expect(schema.parse(full)).toEqual(full);
  });

  it('refuses a whitespace-only comment when the field cannot be blank, and trims a real one', () => {
    expect(() => schema.parse({ ...minimal, comment: '   ' })).toThrow();
    expect(schema.parse({ ...minimal, comment: '  why  ' }).comment).toBe('why');
  });

  it("refuses a comment over the consumer's declared max", () => {
    expect(() => schema.parse({ ...minimal, comment: 'a'.repeat(1001) })).toThrow();
  });

  it('allows an absent comment only when the consumer makes the field optional', () => {
    const { comment: _comment, ...withoutComment } = minimal;
    expect(() => schema.parse(withoutComment)).toThrow();
    const optional = createSubmitReportRequestSchema({ comment: textField(COMMENT).optional() });
    expect(optional.parse(withoutComment)).toEqual(withoutComment);
  });

  it('rejects empty reason', () => {
    expect(() => schema.parse({ ...minimal, reason: '' })).toThrow();
  });

  it('rejects unknown keys (e.g. reportId should not be accepted)', () => {
    expect(() => schema.parse({ ...minimal, reportId: 'uid_item-1' })).toThrow();
  });

  it('rejects empty itemType and reportedItemId', () => {
    expect(() => schema.parse({ ...minimal, itemType: '' })).toThrow();
    expect(() => schema.parse({ ...minimal, reportedItemId: '' })).toThrow();
  });
});
