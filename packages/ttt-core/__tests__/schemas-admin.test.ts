import { describe, it, expect } from 'vitest';
import { UpdateAdminListInputSchema } from '../src/schemas/admin.js';

describe('UpdateAdminListInputSchema', () => {
  it('accepts a single addAdmins entry', () => {
    const parsed = UpdateAdminListInputSchema.parse({ addAdmins: ['uid-1'] });
    expect(parsed.addAdmins).toEqual(['uid-1']);
  });

  it('accepts all four fields together', () => {
    const parsed = UpdateAdminListInputSchema.parse({
      addAdmins: ['a1'],
      removeAdmins: ['a2'],
      addJrAdmins: ['j1'],
      removeJrAdmins: ['j2'],
    });
    expect(parsed).toEqual({
      addAdmins: ['a1'],
      removeAdmins: ['a2'],
      addJrAdmins: ['j1'],
      removeJrAdmins: ['j2'],
    });
  });

  it('rejects empty input (all four fields missing or empty)', () => {
    expect(() => UpdateAdminListInputSchema.parse({})).toThrow();
    expect(() =>
      UpdateAdminListInputSchema.parse({
        addAdmins: [],
        removeAdmins: [],
        addJrAdmins: [],
        removeJrAdmins: [],
      }),
    ).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() =>
      UpdateAdminListInputSchema.parse({ addAdmins: ['uid-1'], extra: 'nope' } as unknown),
    ).toThrow();
  });

  it('rejects an empty-string UID', () => {
    expect(() => UpdateAdminListInputSchema.parse({ addAdmins: [''] })).toThrow();
  });

  it('rejects an over-length UID (>128 chars)', () => {
    const longUid = 'a'.repeat(129);
    expect(() => UpdateAdminListInputSchema.parse({ addAdmins: [longUid] })).toThrow();
  });
});
