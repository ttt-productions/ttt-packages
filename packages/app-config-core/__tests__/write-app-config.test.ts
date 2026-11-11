import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import { defineAppConfig } from '../src/app-config-definition.js';
import { AppConfigInvalidError } from '../src/app-config-invalid-error.js';
import { writeAppConfig } from '../src/server/write-app-config.js';
import type { AppConfigWriter } from '../src/server/write-app-config.js';

const PATH = 'settings/site';

const definition = defineAppConfig({
  path: PATH,
  schema: z.object({
    version: z.string().max(5),
    registrationOpen: z.boolean(),
    limitScale: z.number().gt(0).max(1),
    documents: z.object({
      versions: z.record(z.string(), z.number().int()),
      requiredLevel: z.number().int(),
    }),
  }),
});

const COMPLETE = {
  version: '2.0',
  registrationOpen: true,
  limitScale: 1,
  documents: { versions: { terms: 3 }, requiredLevel: 1 },
};

const MARKERS = { stats: 'x1', leagues: 'y7' };

function spyWriter() {
  return { update: vi.fn<AppConfigWriter['update']>() };
}

// `store.db` is typed as the Admin SDK's Firestore, so the cases that hand the writer one of its
// transactions also prove the Admin SDK's own transaction satisfies the writer's contract.
function seededStore(stored: Record<string, unknown> = { ...COMPLETE, markers: MARKERS }) {
  const store = makeInMemoryFirestore();
  store.seed(PATH, stored);
  const save = (update: Parameters<typeof definition.merge>[1]) =>
    store.db.runTransaction(async (transaction) => {
      const ref = store.db.doc(PATH);
      const snapshot = await transaction.get(ref);
      return writeAppConfig(transaction, {
        ref,
        definition,
        stored: snapshot.data() ?? null,
        update,
      });
    });
  return { store, save };
}

describe('writeAppConfig — the one writer', () => {
  it("writes only the changed settings with update() on the caller's transaction", async () => {
    const { store, save } = seededStore();
    await save({ version: '2.1', registrationOpen: true });

    expect(store.writes()).toEqual([{ kind: 'update', path: PATH, data: { version: '2.1' } }]);
    expect(store.read(PATH)).toEqual({ ...COMPLETE, version: '2.1', markers: MARKERS });
  });

  it('returns each changed setting with its value before and after, for the audit', async () => {
    const { save } = seededStore();
    const written = await save({ version: '2.1', limitScale: 0.5, registrationOpen: true });

    expect(written).toEqual({
      updatedSettings: ['version', 'limitScale'],
      changes: {
        version: { before: '2.0', after: '2.1' },
        limitScale: { before: 1, after: 0.5 },
      },
    });
  });

  it('never touches a stored field that is not a setting', async () => {
    const { store, save } = seededStore();
    await save({ registrationOpen: false });

    expect(store.read(PATH)).toEqual({ ...COMPLETE, registrationOpen: false, markers: MARKERS });
  });

  it('hands update() exactly the changed settings and no other key', () => {
    const writer = spyWriter();
    const { store } = seededStore();
    const ref = store.db.doc(PATH);
    const update = {
      version: '2.0',
      registrationOpen: false,
      documents: { versions: { terms: 3 }, requiredLevel: 1 },
      markers: { stats: 'x2' },
    };
    writeAppConfig(writer, {
      ref,
      definition,
      stored: { ...COMPLETE, markers: MARKERS },
      update,
    });

    expect(writer.update).toHaveBeenCalledTimes(1);
    expect(writer.update).toHaveBeenCalledWith(ref, { registrationOpen: false });
    const [, payload] = writer.update.mock.calls[0] ?? [];
    expect(Object.keys(payload ?? {})).toEqual(['registrationOpen']);
  });

  it('never writes an unchanged nested block sent again, and writes a changed one whole', async () => {
    const unchanged = seededStore();
    const quiet = await unchanged.save({
      documents: { versions: { terms: 3 }, requiredLevel: 1 },
    });
    expect(quiet).toEqual({ updatedSettings: [], changes: {} });
    expect(unchanged.store.writes()).toEqual([]);

    const changed = seededStore();
    await changed.save({ documents: { versions: { terms: 4 }, requiredLevel: 1 } });
    expect(changed.store.writes()).toEqual([
      {
        kind: 'update',
        path: PATH,
        data: { documents: { versions: { terms: 4 }, requiredLevel: 1 } },
      },
    ]);
  });

  it('calls update() zero times when nothing changed', () => {
    const writer = spyWriter();
    const { store } = seededStore();
    const written = writeAppConfig(writer, {
      ref: store.db.doc(PATH),
      definition,
      stored: COMPLETE,
      update: { version: '2.0', registrationOpen: true },
    });

    expect(written).toEqual({ updatedSettings: [], changes: {} });
    expect(writer.update).not.toHaveBeenCalled();
  });

  it('refuses an update whose result would not match the schema, and calls update() never', () => {
    const writer = spyWriter();
    const { store } = seededStore();

    expect(() =>
      writeAppConfig(writer, {
        ref: store.db.doc(PATH),
        definition,
        stored: COMPLETE,
        update: { version: '2.1', limitScale: 2 },
      }),
    ).toThrow(AppConfigInvalidError);
    expect(writer.update).not.toHaveBeenCalled();
  });

  it('throws for a missing stored document and calls update() never', () => {
    const writer = spyWriter();
    const { store } = seededStore();
    for (const stored of [null, undefined]) {
      expect(() =>
        writeAppConfig(writer, {
          ref: store.db.doc(PATH),
          definition,
          stored,
          update: { registrationOpen: false },
        }),
      ).toThrow(AppConfigInvalidError);
    }
    expect(writer.update).not.toHaveBeenCalled();
  });

  it('throws for an invalid stored document and calls update() never', () => {
    const writer = spyWriter();
    const { store } = seededStore();
    const missingOne: Record<string, unknown> = { ...COMPLETE };
    delete missingOne.limitScale;
    for (const stored of [missingOne, { ...COMPLETE, registrationOpen: 'yes' }]) {
      expect(() =>
        writeAppConfig(writer, {
          ref: store.db.doc(PATH),
          definition,
          stored,
          update: { registrationOpen: false },
        }),
      ).toThrow(AppConfigInvalidError);
    }
    expect(writer.update).not.toHaveBeenCalled();
  });

  it('writes nothing to the store when the stored document is missing', async () => {
    const store = makeInMemoryFirestore();
    await expect(
      store.db.runTransaction(async (transaction) => {
        const ref = store.db.doc(PATH);
        const snapshot = await transaction.get(ref);
        return writeAppConfig(transaction, {
          ref,
          definition,
          stored: snapshot.data() ?? null,
          update: { registrationOpen: false },
        });
      }),
    ).rejects.toThrow('settings/site does not exist.');
    expect(store.writes()).toEqual([]);
    expect(store.read(PATH)).toBeUndefined();
  });
});
