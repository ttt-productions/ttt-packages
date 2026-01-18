'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
import type { Firestore } from 'firebase/firestore';

interface FirestoreContextValue {
  db: Firestore;
}

const FirestoreContext = createContext<FirestoreContextValue | null>(null);

export interface FirestoreProviderProps {
  db: Firestore;
  children: ReactNode;
}

/**
 * Provides Firestore instance to all useFirestore* hooks.
 * Wrap your app with this provider alongside TTTQueryProvider.
 * 
 * @example
 * ```tsx
 * import { db } from '@/lib/firebase';
 * 
 * <TTTQueryProvider>
 *   <FirestoreProvider db={db}>
 *     {children}
 *   </FirestoreProvider>
 * </TTTQueryProvider>
 * ```
 */
export function FirestoreProvider({ db, children }: FirestoreProviderProps) {
  return (
    <FirestoreContext.Provider value={{ db }}>
      {children}
    </FirestoreContext.Provider>
  );
}

/**
 * Access the Firestore instance from context.
 * Throws if used outside of FirestoreProvider.
 */
export function useFirestoreDb(): Firestore {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error(
      'useFirestoreDb must be used within a FirestoreProvider. ' +
      'Wrap your app with <FirestoreProvider db={db}>.'
    );
  }
  return context.db;
}
