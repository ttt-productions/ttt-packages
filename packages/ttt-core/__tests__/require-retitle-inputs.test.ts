import { describe, it, expect } from 'vitest';
import {
  RequireWorkProjectRetitleInputSchema,
  RequireWorkRealmRetitleInputSchema,
} from '../src/schemas/admin.js';
import { MAX_REQUIRE_RETITLE_REASON_LENGTH } from '../src/constants/business-admin.js';

const NOT_ONE_SEGMENT = ['', 'a/b', '.', '..', '__reserved__'];

const CASES = [
  {
    name: 'Work',
    schema: RequireWorkProjectRetitleInputSchema,
    idField: 'workProjectId',
    otherIdField: 'workRealmId',
  },
  {
    name: 'Realm',
    schema: RequireWorkRealmRetitleInputSchema,
    idField: 'workRealmId',
    otherIdField: 'workProjectId',
  },
] as const;

describe.each(CASES)('require $name retitle input', ({ schema, idField, otherIdField }) => {
  it('takes the target and the reason, trimmed', () => {
    expect(schema.parse({ [idField]: 'target-1', reason: '  slur in the title  ' })).toEqual({
      [idField]: 'target-1',
      reason: 'slur in the title',
    });
  });

  it('requires a reason that is not blank', () => {
    expect(schema.safeParse({ [idField]: 'target-1' }).success).toBe(false);
    expect(schema.safeParse({ [idField]: 'target-1', reason: '   ' }).success).toBe(false);
  });

  it('takes a reason up to the retitle reason length and no longer', () => {
    expect(
      schema.safeParse({
        [idField]: 'target-1',
        reason: 'a'.repeat(MAX_REQUIRE_RETITLE_REASON_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        [idField]: 'target-1',
        reason: 'a'.repeat(MAX_REQUIRE_RETITLE_REASON_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('requires the target id', () => {
    expect(schema.safeParse({ reason: 'x' }).success).toBe(false);
  });

  it.each(NOT_ONE_SEGMENT)('refuses a target id that is not one document id (%j)', (id) => {
    expect(schema.safeParse({ [idField]: id, reason: 'x' }).success).toBe(false);
  });

  it("refuses the other target kind's id and any other unknown key", () => {
    expect(
      schema.safeParse({ [idField]: 'target-1', [otherIdField]: 'target-2', reason: 'x' }).success,
    ).toBe(false);
    expect(schema.safeParse({ [idField]: 'target-1', reason: 'x', extra: true }).success).toBe(
      false,
    );
  });
});
