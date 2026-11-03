import type { DocumentReference } from 'firebase-admin/firestore';

export interface CreateOnlyWriter {
  create(ref: DocumentReference, data: Record<string, unknown>): unknown;
}
