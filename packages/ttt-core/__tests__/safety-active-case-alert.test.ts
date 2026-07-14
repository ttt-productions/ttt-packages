// The ONE canonical active-safety-case-alert writer, exercised with a fake tx/db
// (ttt-core carries no firebase-admin runtime dependency — the writer takes minimal
// STRUCTURAL Firestore handles).

import { describe, it, expect, vi } from 'vitest';
import {
  writeActiveSafetyCaseAlert,
  deleteActiveSafetyCaseAlert,
  type SafetyAlertDbLike,
  type SafetyAlertDocRefLike,
  type SafetyAlertTransactionLike,
} from '../src/safety/active-safety-case-alert.js';

/** A fake db whose doc() returns a ref tagged with the path it was built from, so the
 *  test can assert the writer routed through the canonical path builder. */
function makeFakeDb(): { db: SafetyAlertDbLike; deletes: string[]; docPaths: string[] } {
  const deletes: string[] = [];
  const docPaths: string[] = [];
  const db: SafetyAlertDbLike = {
    doc(path: string): SafetyAlertDocRefLike & { __path: string } {
      docPaths.push(path);
      return {
        __path: path,
        delete: () => {
          deletes.push(path);
          return Promise.resolve();
        },
      };
    },
  };
  return { db, deletes, docPaths };
}

describe('writeActiveSafetyCaseAlert', () => {
  it('creates the PII-free SafetyCaseAlertV1 at activeSafetyCaseAlerts/{caseId}', () => {
    const { db, docPaths } = makeFakeDb();
    const create = vi.fn();
    const tx: SafetyAlertTransactionLike = { create };

    writeActiveSafetyCaseAlert(tx, { db, caseId: 'case_1', caseKind: 'childSafety', now: 1_700_000_000_000 });

    expect(docPaths).toEqual(['activeSafetyCaseAlerts/case_1']);
    expect(create).toHaveBeenCalledTimes(1);
    const [ref, data] = create.mock.calls[0];
    expect((ref as { __path: string }).__path).toBe('activeSafetyCaseAlerts/case_1');
    expect(data).toEqual({
      schemaVersion: 1,
      caseId: 'case_1',
      caseKind: 'childSafety',
      createdAt: 1_700_000_000_000,
    });
  });

  it('carries the ncii caseKind through for a statutory take-it-down request', () => {
    const { db } = makeFakeDb();
    const create = vi.fn();
    writeActiveSafetyCaseAlert({ create }, { db, caseId: 'req_9', caseKind: 'ncii', now: 42 });
    expect(create.mock.calls[0][1]).toMatchObject({ caseKind: 'ncii', caseId: 'req_9' });
  });
});

describe('deleteActiveSafetyCaseAlert', () => {
  it('deletes the pin at the canonical path', async () => {
    const { db, deletes } = makeFakeDb();
    await deleteActiveSafetyCaseAlert(db, 'case_1');
    expect(deletes).toEqual(['activeSafetyCaseAlerts/case_1']);
  });
});
