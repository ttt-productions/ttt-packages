// Every file-bearing upload-variables schema carries the optional untrusted
// `claim` (ClientMediaClaim) so hooks can thread MediaInput's action context to
// startUpload. Coverage is asserted structurally over every module under
// `src/upload-variables/`, whatever its name: any `*VariablesSchema` there must
// have a File field and the claim field, so a new file-bearing hook schema
// cannot ship without it.

import { readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { UploadProfilePictureVariablesSchema } from '../src/upload-variables/upload-profile-picture-variables.js';

const FILE_FIELDS = ['file', 'mediaFile', 'videoFile'];
const VARIABLES_DIR = new URL('../src/upload-variables/', import.meta.url);

// Every module in the folder but the entry index, which only forwards them.
const variablesModules = readdirSync(VARIABLES_DIR, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.ts') && !/(^|[\\/])index\.ts$/.test(file),
);

// A variables schema split by type (a union) is checked option by option.
function shapesOf(schema: unknown): z.ZodRawShape[] {
  if (schema instanceof z.ZodObject) return [schema.shape];
  if (schema instanceof z.ZodUnion) return schema.options.flatMap(shapesOf);
  return [];
}

async function variablesSchemas(): Promise<Array<[string, z.ZodRawShape[]]>> {
  const schemas: Array<[string, z.ZodRawShape[]]> = [];
  for (const file of variablesModules) {
    const mod: Record<string, unknown> = await import(new URL(file, VARIABLES_DIR).href);
    for (const [name, value] of Object.entries(mod)) {
      if (name.endsWith('VariablesSchema')) schemas.push([name, shapesOf(value)]);
    }
  }
  return schemas;
}

describe('the upload-variables claim field', () => {
  it('claim accepts a valid ClientMediaClaim, absence, and rejects junk', () => {
    const schema = UploadProfilePictureVariablesSchema;
    const base = { file: new Blob(['x']) };
    expect(schema.safeParse(base).success).toBe(true);
    expect(
      schema.safeParse({ ...base, claim: { kind: 'image', source: 'file-picker' } }).success,
    ).toBe(true);
    expect(schema.safeParse({ ...base, claim: { kind: 'image', source: 'guess' } }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, claim: { kind: 'image' } }).success).toBe(false);
  });

  it('the scan finds the variables schemas', async () => {
    expect((await variablesSchemas()).length).toBeGreaterThan(0);
  });

  it('every file-bearing variables schema has the optional claim field', async () => {
    for (const [name, shapes] of await variablesSchemas()) {
      const notObject = `${name} is neither an object nor a union of objects`;
      expect(shapes.length, notObject).toBeGreaterThan(0);
      for (const shape of shapes) {
        const hasFile = FILE_FIELDS.some((f) => f in shape);
        expect(hasFile, `${name} has no recognized file field`).toBe(true);
        expect('claim' in shape, `${name} is missing the claim field`).toBe(true);
      }
    }
  });
});
