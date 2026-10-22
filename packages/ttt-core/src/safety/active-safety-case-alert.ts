// Structural Firestore handles: ttt-core cannot depend on firebase-admin.

import { PATH_BUILDERS } from '../paths/path-builders.js';
import { toPath } from '../paths/utils.js';
import type { SafetyCaseAlertV1, SafetyCaseAlertKind } from '../doc-schemas/safety/case-alert.js';

const SCHEMA_VERSION = 1 as const;

export interface SafetyAlertDocRefLike {
  delete(): Promise<unknown>;
}

export interface SafetyAlertTransactionLike {
  create(documentRef: SafetyAlertDocRefLike, data: SafetyCaseAlertV1): void;
}

export interface SafetyAlertDbLike {
  doc(path: string): SafetyAlertDocRefLike;
}

export function writeActiveSafetyCaseAlert(
  tx: SafetyAlertTransactionLike,
  args: { db: SafetyAlertDbLike; caseId: string; caseKind: SafetyCaseAlertKind; now: number },
): void {
  const alert: SafetyCaseAlertV1 = {
    schemaVersion: SCHEMA_VERSION,
    caseId: args.caseId,
    caseKind: args.caseKind,
    createdAt: args.now,
  };
  tx.create(args.db.doc(toPath(PATH_BUILDERS.safetyCaseAlert(args.caseId))), alert);
}

export async function deleteActiveSafetyCaseAlert(
  db: SafetyAlertDbLike,
  caseId: string,
): Promise<void> {
  await db.doc(toPath(PATH_BUILDERS.safetyCaseAlert(caseId))).delete();
}
