import { describe, it, expect } from 'vitest';
import {
  CheckoutTaskRequestSchema,
  CheckinTaskRequestSchema,
  ReleaseTaskRequestSchema,
  CreateContentReportRequestSchema,
} from '../src/schemas/index';

describe('CheckoutTaskRequestSchema', () => {
  it('accepts taskType only', () => {
    const r = { taskType: 'profilePicture' };
    expect(CheckoutTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('rejects specificTaskId (the cherry-pick path was removed)', () => {
    expect(() =>
      CheckoutTaskRequestSchema.parse({ taskType: 'profilePicture', specificTaskId: 'task-1' }),
    ).toThrow();
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

describe('CheckinTaskRequestSchema', () => {
  it('accepts a resolved checkin', () => {
    const r = { taskId: 'task-1', resolved: true, resolution: 'Cleared profanity' };
    expect(CheckinTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('accepts a checkin without resolution text', () => {
    const r = { taskId: 'task-1', resolved: false };
    expect(CheckinTaskRequestSchema.parse(r)).toEqual(r);
  });
  it('rejects missing resolved field', () => {
    expect(() =>
      CheckinTaskRequestSchema.parse({ taskId: 'task-1' }),
    ).toThrow();
  });
  it('rejects resolution longer than 2000 chars', () => {
    expect(() =>
      CheckinTaskRequestSchema.parse({
        taskId: 'task-1',
        resolved: true,
        resolution: 'a'.repeat(2001),
      }),
    ).toThrow();
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

describe('CreateContentReportRequestSchema', () => {
  const minimal = {
    reportedItemType: 'post',
    reportedItemId: 'item-1',
    reason: 'spam',
    comment: 'This is spam content',
  };

  it('accepts a minimal valid request (required fields only)', () => {
    expect(CreateContentReportRequestSchema.parse(minimal)).toEqual(minimal);
  });

  it('accepts a request with all optional fields populated', () => {
    const full = {
      ...minimal,
      parentItemId: 'parent-1',
      reportedUserId: 'user-2',
    };
    expect(CreateContentReportRequestSchema.parse(full)).toEqual(full);
  });

  it('rejects empty reason', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, reason: '' }),
    ).toThrow();
  });

  it('rejects empty comment', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, comment: '' }),
    ).toThrow();
  });

  it('rejects comment over 4000 chars', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, comment: 'a'.repeat(4001) }),
    ).toThrow();
  });

  it('rejects unknown keys (e.g. reportId should not be accepted)', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, reportId: 'uid_item-1' }),
    ).toThrow();
  });

  it('rejects empty reportedItemType', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, reportedItemType: '' }),
    ).toThrow();
  });

  it('rejects empty reportedItemId', () => {
    expect(() =>
      CreateContentReportRequestSchema.parse({ ...minimal, reportedItemId: '' }),
    ).toThrow();
  });
});
