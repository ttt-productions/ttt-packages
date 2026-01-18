'use client';

import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { useFirestoreDb } from './context';
import type { FirestoreMutationOptions, FirestoreBatchOptions, MutationOperation } from './types';

const DEFAULT_BATCH_SIZE = 450;

interface SetResult<T> {
  id: string;
  data: T;
}

export function useFirestoreSet<T extends DocumentData>({
  invalidateKeys = [],
}: Pick<FirestoreMutationOptions<T>, 'invalidateKeys'> = {}): UseMutationResult<
  SetResult<T>,
  Error,
  { docPath: string; data: T; merge?: boolean }
> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      docPath,
      data,
      merge = false,
    }: {
      docPath: string;
      data: T;
      merge?: boolean;
    }) => {
      const docRef = doc(db, docPath);
      await setDoc(docRef, data, { merge });
      return { id: docRef.id, data };
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

export function useFirestoreUpdate<T extends DocumentData>({
  invalidateKeys = [],
  optimistic,
}: FirestoreMutationOptions<T> = {}): UseMutationResult<
  Partial<T>,
  Error,
  { docPath: string; data: Partial<T> },
  { previousData: T | undefined } | undefined
> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      docPath,
      data,
    }: {
      docPath: string;
      data: Partial<T>;
    }) => {
      const docRef = doc(db, docPath);
      await updateDoc(docRef, data as DocumentData);
      return data;
    },
    onMutate: async ({ data }) => {
      if (!optimistic) return undefined;

      await queryClient.cancelQueries({ queryKey: optimistic.queryKey });
      const previousData = queryClient.getQueryData<T>(optimistic.queryKey);

      queryClient.setQueryData<T>(optimistic.queryKey, (old) =>
        optimistic.updater(old, data as Partial<T>)
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (optimistic && context?.previousData !== undefined) {
        queryClient.setQueryData(optimistic.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      if (optimistic) {
        queryClient.invalidateQueries({ queryKey: optimistic.queryKey });
      }
    },
  });
}

export function useFirestoreDelete<T = unknown>({
  invalidateKeys = [],
  optimistic,
}: {
  invalidateKeys?: readonly QueryKey[];
  optimistic?: {
    queryKey: QueryKey;
    updater: (oldData: T | undefined, docPath: string) => T;
  };
} = {}): UseMutationResult<
  string,
  Error,
  { docPath: string },
  { previousData: T | undefined } | undefined
> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docPath }: { docPath: string }) => {
      const docRef = doc(db, docPath);
      await deleteDoc(docRef);
      return docPath;
    },
    onMutate: async ({ docPath }) => {
      if (!optimistic) return undefined;

      await queryClient.cancelQueries({ queryKey: optimistic.queryKey });
      const previousData = queryClient.getQueryData<T>(optimistic.queryKey);

      queryClient.setQueryData<T>(optimistic.queryKey, (old) =>
        optimistic.updater(old, docPath)
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (optimistic && context?.previousData !== undefined) {
        queryClient.setQueryData(optimistic.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      if (optimistic) {
        queryClient.invalidateQueries({ queryKey: optimistic.queryKey });
      }
    },
  });
}

interface BatchResult {
  committed: number;
  batches: number;
}

export function useFirestoreBatch({
  invalidateKeys = [],
  batchSize = DEFAULT_BATCH_SIZE,
}: FirestoreBatchOptions = {}): UseMutationResult<
  BatchResult,
  Error,
  { operations: MutationOperation[] }
> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      operations,
    }: {
      operations: MutationOperation[];
    }) => {
      const chunks: MutationOperation[][] = [];
      for (let i = 0; i < operations.length; i += batchSize) {
        chunks.push(operations.slice(i, i + batchSize));
      }

      let totalCommitted = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        for (const op of chunk) {
          const docRef = doc(db, op.docPath);

          switch (op.type) {
            case 'set':
              if (op.merge) {
                batch.set(docRef, op.data, { merge: true });
              } else {
                batch.set(docRef, op.data);
              }
              break;
            case 'update':
              batch.update(docRef, op.data);
              break;
            case 'delete':
              batch.delete(docRef);
              break;
          }
        }

        await batch.commit();
        totalCommitted += chunk.length;
      }

      return {
        committed: totalCommitted,
        batches: chunks.length,
      };
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}