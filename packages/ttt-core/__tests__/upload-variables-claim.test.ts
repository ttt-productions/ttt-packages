import { describe, it, expect } from 'vitest';
import { UploadProfilePictureVariablesSchema } from '../src/upload-variables/upload-profile-picture-variables.js';

describe('the upload-variables claim field', () => {
  it('claim accepts a valid ClientMediaClaim, absence, and rejects junk', () => {
    const schema = UploadProfilePictureVariablesSchema;
    const base = { file: new Blob(['x']) };
    expect(schema.safeParse(base).success).toBe(true);
    expect(
      schema.safeParse({ ...base, claim: { kind: 'image', source: 'file-picker' } }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...base, claim: { kind: 'image', source: 'guess' } }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...base, claim: { kind: 'image' } }).success).toBe(false);
  });
});
