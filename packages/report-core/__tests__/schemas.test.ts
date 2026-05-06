import { describe, it, expect } from 'vitest';
import {
  CheckoutTaskRequestSchema,
  CheckinTaskRequestSchema,
  ReleaseTaskRequestSchema,
} from '../src/schemas/index';

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
