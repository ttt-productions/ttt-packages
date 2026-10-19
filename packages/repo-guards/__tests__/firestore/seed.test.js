// Seed fixtures reach the database only through the app's registry: a full seed is parsed and the
// parsed document written; a merge patch may write only declared fields; an unregistered path, or
// a schema whose fields cannot be read, fails closed.

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createRegistrySeedWriter, registeredSchemaForPath } from '../../src/seed/seed-writer.js';

const ProfileSchema = z.object({ uid: z.string(), displayName: z.string(), bio: z.string().optional() });
const PreferencesSchema = z.object({ theme: z.enum(['light', 'dark']) });
const PrivateDataSchema = z.object({ email: z.string() });
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), a: z.number() }),
  z.object({ type: z.literal('b'), b: z.number() }),
]);

const SCHEMAS = Object.freeze({
  'profiles/{uid}': ProfileSchema,
  'profiles/{uid}/privateData/{docId}': PrivateDataSchema,
  'profiles/{uid}/privateData/preferences': PreferencesSchema,
  'events/{eventId}': EventSchema,
});

function makeWriter() {
  const write = vi.fn(async () => undefined);
  return { write, ...createRegistrySeedWriter({ schemas: SCHEMAS, write, registryName: 'app-core' }) };
}

describe('registeredSchemaForPath', () => {
  it('matches a concrete path to its template, placeholders matching any id', () => {
    expect(registeredSchemaForPath(SCHEMAS, 'profiles/u1')?.template).toBe('profiles/{uid}');
  });

  it('prefers the template with more literal segments, so a fixed-id document takes its own schema', () => {
    expect(registeredSchemaForPath(SCHEMAS, 'profiles/u1/privateData/preferences')?.schema).toBe(PreferencesSchema);
    expect(registeredSchemaForPath(SCHEMAS, 'profiles/u1/privateData/contact')?.schema).toBe(PrivateDataSchema);
  });

  it('finds nothing for a path of another depth or an unregistered collection', () => {
    expect(registeredSchemaForPath(SCHEMAS, 'profiles')).toBeNull();
    expect(registeredSchemaForPath(SCHEMAS, 'notRegistered/doc-1')).toBeNull();
  });
});

describe('setSeededDoc', () => {
  it('writes the PARSED document, so a field no schema declares never lands', async () => {
    const { write, setSeededDoc } = makeWriter();
    await setSeededDoc('profiles/u1', { uid: 'u1', displayName: 'Ada', strayField: true });
    expect(write).toHaveBeenCalledWith('profiles/u1', { uid: 'u1', displayName: 'Ada' }, false);
  });

  it('refuses a fixture missing a required field, naming the path and the field, and writes nothing', async () => {
    const { write, setSeededDoc } = makeWriter();
    await expect(setSeededDoc('profiles/u1', { uid: 'u1' })).rejects.toThrow(
      /Seed fixture does not match its app-core schema: profiles\/u1\n {2}displayName:/,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses an unregistered path and writes nothing', async () => {
    const { write, setSeededDoc } = makeWriter();
    await expect(setSeededDoc('notRegistered/doc-1', { value: true })).rejects.toThrow(
      'Cannot seed unregistered Firestore path notRegistered/doc-1',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('parses a union-shaped document whole', async () => {
    const { write, setSeededDoc } = makeWriter();
    await setSeededDoc('events/e1', { type: 'b', b: 2 });
    expect(write).toHaveBeenCalledWith('events/e1', { type: 'b', b: 2 }, false);
  });
});

describe('mergeSeededDoc', () => {
  it('merges a patch of declared fields as given', async () => {
    const { write, mergeSeededDoc } = makeWriter();
    await mergeSeededDoc('profiles/u1', { bio: 'hello' });
    expect(write).toHaveBeenCalledWith('profiles/u1', { bio: 'hello' }, true);
  });

  it('refuses a patch writing an undeclared field, naming it, and writes nothing', async () => {
    const { write, mergeSeededDoc } = makeWriter();
    await expect(mergeSeededDoc('profiles/u1', { bio: 'x', strayField: 1 })).rejects.toThrow(
      'Seed patch writes fields the app-core schema does not declare on profiles/u1: strayField.',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses a patch to a schema with no readable object shape instead of passing it unchecked', async () => {
    const { write, mergeSeededDoc } = makeWriter();
    await expect(mergeSeededDoc('events/e1', { a: 1 })).rejects.toThrow(
      'Cannot check a seed patch against events/e1: its app-core schema exposes no readable shape',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses an unregistered path and writes nothing', async () => {
    const { write, mergeSeededDoc } = makeWriter();
    await expect(mergeSeededDoc('notRegistered/doc-1', { value: true })).rejects.toThrow(
      'Cannot patch unregistered Firestore path notRegistered/doc-1',
    );
    expect(write).not.toHaveBeenCalled();
  });
});
