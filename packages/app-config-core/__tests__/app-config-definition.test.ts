import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineAppConfig } from '../src/app-config-definition.js';
import { AppConfigInvalidError } from '../src/app-config-invalid-error.js';

const PATH = 'settings/site';

const schema = z.object({
  version: z.string().max(5),
  registrationOpen: z.boolean(),
  notice: z.string().trim(),
  limitScale: z.number().gt(0).max(1),
  documents: z.object({
    versions: z.record(z.string(), z.number().int()),
    requiredLevel: z.number().int(),
  }),
  tags: z.array(z.string()),
});

const definition = defineAppConfig({ path: PATH, schema });

const COMPLETE = {
  version: '2.0',
  registrationOpen: true,
  notice: 'Playoffs start Friday.',
  limitScale: 1,
  documents: { versions: { terms: 3, privacy: 2 }, requiredLevel: 1 },
  tags: ['a', 'b'],
};

const SETTINGS = Object.keys(COMPLETE);

function documentsBlock() {
  return { versions: { terms: 3, privacy: 2 }, requiredLevel: 1 };
}

function invalidity(run: () => unknown): AppConfigInvalidError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppConfigInvalidError) return error;
    throw error;
  }
  throw new Error('the document was not refused');
}

describe('defineAppConfig — the settings', () => {
  it('lists exactly the settings the schema declares', () => {
    expect([...definition.settings].sort()).toEqual([...SETTINGS].sort());
  });

  it('carries the document path the product hands in', () => {
    expect(definition.path).toBe(PATH);
  });
});

describe('read — the strict read', () => {
  it('hands back exactly the stored settings of a complete, valid document', () => {
    expect(definition.read(COMPLETE)).toEqual(COMPLETE);
  });

  it('refuses a missing document as missing, naming the document and no setting', () => {
    for (const stored of [null, undefined]) {
      const error = invalidity(() => definition.read(stored));
      expect(error.problem).toBe('missing-document');
      expect(error.setting).toBeUndefined();
      expect(error.path).toBe(PATH);
      expect(error.message).toBe('settings/site does not exist.');
    }
  });

  it('refuses a document missing any one setting, naming that setting', () => {
    for (const setting of SETTINGS) {
      const stored: Record<string, unknown> = { ...COMPLETE };
      delete stored[setting];
      const error = invalidity(() => definition.read(stored));
      expect(error.problem).toBe('invalid-setting');
      expect(error.setting).toBe(setting);
      expect(error.message).toContain(`settings/site.${setting} is missing or does not match`);
    }
  });

  it('refuses a setting holding a bad value, naming that setting', () => {
    const error = invalidity(() => definition.read({ ...COMPLETE, registrationOpen: 'yes' }));
    expect(error.problem).toBe('invalid-setting');
    expect(error.setting).toBe('registrationOpen');
    expect(invalidity(() => definition.read({ ...COMPLETE, version: '123456' })).setting).toBe(
      'version',
    );
    expect(invalidity(() => definition.read({ ...COMPLETE, limitScale: 0 })).setting).toBe(
      'limitScale',
    );
  });

  it('names the setting that holds a bad value deep inside a nested block, and where in it', () => {
    const error = invalidity(() =>
      definition.read({
        ...COMPLETE,
        documents: { versions: { terms: 'three' }, requiredLevel: 1 },
      }),
    );
    expect(error.setting).toBe('documents');
    expect(error.message).toContain('settings/site.documents');
    expect(error.message).toContain('versions.terms');
  });

  it('refuses an empty document, which holds none of the settings', () => {
    expect(invalidity(() => definition.read({})).problem).toBe('invalid-setting');
  });

  it('ignores a stored field that is not a setting: it is never read, returned, or refused', () => {
    const stored = { ...COMPLETE, markers: { stats: 'x1' }, stray: 'not a setting' };
    expect(definition.read(stored)).toEqual(COMPLETE);
    expect(definition.read({ ...COMPLETE, markers: 42 })).toEqual(COMPLETE);
  });
});

describe('merge — what an update really changes', () => {
  it('returns the settings before and after, and only the setting that changed', () => {
    expect(definition.merge(COMPLETE, { registrationOpen: false })).toEqual({
      before: COMPLETE,
      after: { ...COMPLETE, registrationOpen: false },
      changes: { registrationOpen: false },
    });
  });

  it('leaves a setting sent with its stored value out of the changes', () => {
    const { changes } = definition.merge(COMPLETE, {
      version: '2.1',
      registrationOpen: true,
      limitScale: 1,
      notice: 'Playoffs start Friday.',
    });
    expect(changes).toEqual({ version: '2.1' });
  });

  it('compares a nested block by what it holds: an unchanged copy sent again is no change', () => {
    const { changes } = definition.merge(COMPLETE, {
      documents: documentsBlock(),
      tags: ['a', 'b'],
    });
    expect(changes).toEqual({});
  });

  it('counts a nested block with one value changed as a change, and carries the whole block', () => {
    const documents = { versions: { terms: 4, privacy: 2 }, requiredLevel: 1 };
    const { changes, after } = definition.merge(COMPLETE, { documents });
    expect(changes).toEqual({ documents });
    expect(after.documents).toEqual(documents);
  });

  it('counts a nested block that gained or lost an entry as a change', () => {
    expect(
      definition.merge(COMPLETE, {
        documents: { versions: { terms: 3 }, requiredLevel: 1 },
      }).changes,
    ).toEqual({ documents: { versions: { terms: 3 }, requiredLevel: 1 } });
    expect(
      definition.merge(COMPLETE, {
        documents: { versions: { terms: 3, privacy: 2, cookies: 1 }, requiredLevel: 1 },
      }).changes,
    ).toEqual({
      documents: { versions: { terms: 3, privacy: 2, cookies: 1 }, requiredLevel: 1 },
    });
  });

  it('counts a list in another order as a change', () => {
    expect(definition.merge(COMPLETE, { tags: ['b', 'a'] }).changes).toEqual({ tags: ['b', 'a'] });
  });

  it('compares the value the schema keeps, so text that differs only by what it trims is no change', () => {
    expect(definition.merge(COMPLETE, { notice: '  Playoffs start Friday.  ' }).changes).toEqual(
      {},
    );
  });

  it('changes a number setting', () => {
    expect(definition.merge(COMPLETE, { limitScale: 0.5 }).changes).toEqual({ limitScale: 0.5 });
  });

  it('sends nothing for a setting the update leaves undefined', () => {
    expect(definition.merge(COMPLETE, { version: '2.1', notice: undefined }).changes).toEqual({
      version: '2.1',
    });
  });

  it('changes nothing for an empty update', () => {
    expect(definition.merge(COMPLETE, {})).toEqual({
      before: COMPLETE,
      after: COMPLETE,
      changes: {},
    });
  });

  it('never holds a field that is not a setting, stored or sent', () => {
    const update = { registrationOpen: false, markers: { stats: 'x2' } };
    const merged = definition.merge({ ...COMPLETE, markers: { stats: 'x1' } }, update);
    expect(merged.before).toEqual(COMPLETE);
    expect(merged.after).toEqual({ ...COMPLETE, registrationOpen: false });
    expect(merged.changes).toEqual({ registrationOpen: false });
  });

  it('refuses an update whose result would not match the schema, naming the setting', () => {
    const error = invalidity(() => definition.merge(COMPLETE, { version: '1234567' }));
    expect(error.problem).toBe('invalid-update');
    expect(error.setting).toBe('version');
    expect(error.message).toContain('settings/site.version would not match its schema');
  });

  it('refuses an update against a missing document: it never creates one', () => {
    expect(invalidity(() => definition.merge(null, { registrationOpen: false })).problem).toBe(
      'missing-document',
    );
  });

  it('refuses an update against a document missing a setting: it never fills one in', () => {
    const stored: Record<string, unknown> = { ...COMPLETE };
    delete stored.notice;
    const error = invalidity(() => definition.merge(stored, { registrationOpen: false }));
    expect(error.problem).toBe('invalid-setting');
    expect(error.setting).toBe('notice');
  });

  it('refuses an update against a stored bad value, even one the update sends: it never repairs one', () => {
    const error = invalidity(() =>
      definition.merge({ ...COMPLETE, registrationOpen: 'yes' }, { registrationOpen: true }),
    );
    expect(error.problem).toBe('invalid-setting');
    expect(error.setting).toBe('registrationOpen');
  });
});
