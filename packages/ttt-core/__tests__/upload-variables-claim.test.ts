// Every file-bearing upload-variables schema carries the optional untrusted
// `claim` (ClientMediaClaim) so hooks can thread MediaInput's action context to
// startUpload. Coverage is asserted structurally: any exported *VariablesSchema
// whose shape has a File field must also have the claim field — a new
// file-bearing hook schema cannot ship without it.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as uploadVariables from '../src/upload-variables/index.js';

const FILE_FIELDS = ['file', 'mediaFile', 'videoFile'];

const schemaEntries = Object.entries(uploadVariables).filter(
  ([name, value]) => name.endsWith('VariablesSchema') && value instanceof z.ZodObject,
) as Array<[string, z.ZodObject<z.ZodRawShape>]>;

describe('upload-variables claim coverage', () => {
  it('finds the variables schemas (guard against export-shape drift)', () => {
    expect(schemaEntries.length).toBeGreaterThanOrEqual(15);
  });

  it('every file-bearing variables schema has the optional claim field', () => {
    for (const [name, schema] of schemaEntries) {
      const shape = schema.shape;
      const hasFile = FILE_FIELDS.some((f) => f in shape);
      expect(hasFile, `${name} has no recognized file field`).toBe(true);
      expect('claim' in shape, `${name} is missing the claim field`).toBe(true);
    }
  });

  it('claim accepts a valid ClientMediaClaim, absence, and rejects junk', () => {
    const schema = uploadVariables.UploadProfilePictureVariablesSchema;
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
