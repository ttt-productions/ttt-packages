import type { InMemoryClientFirestore } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { passThroughModule } from './typed-mock.js';

type FirestoreModule = typeof import('firebase/firestore');

export function clientFirestoreFake(
  importOriginal: () => Promise<FirestoreModule>,
  store: InMemoryClientFirestore,
  overrides: Partial<FirestoreModule> = {},
): Promise<FirestoreModule> {
  return passThroughModule(importOriginal, { ...store.reads, ...overrides });
}
