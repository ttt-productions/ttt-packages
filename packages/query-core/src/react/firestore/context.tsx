'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Firestore } from 'firebase/firestore';

interface FirestoreContextValue {
  db: Firestore;
}

const FirestoreContext = createContext<FirestoreContextValue | null>(null);

export interface FirestoreProviderProps {
  db: Firestore;
  children: ReactNode;
}

export function FirestoreProvider({ db, children }: FirestoreProviderProps) {
  return <FirestoreContext.Provider value={{ db }}>{children}</FirestoreContext.Provider>;
}

export function useFirestoreDb(): Firestore {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error(
      'useFirestoreDb must be used within a FirestoreProvider. ' +
        'Wrap your app with <FirestoreProvider db={db}>.',
    );
  }
  return context.db;
}
