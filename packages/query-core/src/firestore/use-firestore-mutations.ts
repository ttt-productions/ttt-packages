'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
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

/**
 * Set (create or overwrite) a Firestore document.
 * 
 * @example
 * ```tsx
 * const setUser = useFirestoreSet<User>({
 *   invalidateKeys: [['users']],
 * });
 * 
 * setUser.mutate({
 *   docPath: `users/${userId}`,
 *   data: { name: 'John', email: 'john@example.com' },
 *   merge: true, // optional: merge with existing data
 * });
 * ```
 */
export function useFirestoreSet<T extends DocumentData>({
  invalidateKeys = [],
}: Pick<FirestoreMutationOptions<T>, 'invalidateKeys'> = {}) {
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
      return { id: docRef.id, ...data };
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

/**
 * Update a Firestore document with optimistic updates.
 * 
 * @example
 * ```tsx
 * const updateProject = useFirestoreUpdate<Project>({
 *   invalidateKeys: [['projects']],
 *   optimistic: {
 *     queryKey: ['project', projectId],
 *     updater: (old, newData) => ({ ...old, ...newData }),
 *   },
 * });
 * 
 * updateProject.mutate({
 *   docPath: `projects/${projectId}`,
 *   data: { title: 'New Title' },
 * });
 * ```
 */
export function useFirestoreUpdate<T extends DocumentData>({
  invalidateKeys = [],
  optimistic,
}: FirestoreMutationOptions<T> = {}) {
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
      if (!optimistic) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: optimistic.queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T>(optimistic.queryKey);

      // Optimistically update
      queryClient.setQueryData<T>(optimistic.queryKey, (old) =>
        optimistic.updater(old, data as Partial<T>)
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (optimistic && context?.previousData !== undefined) {
        queryClient.setQueryData(optimistic.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate to refetch
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      if (optimistic) {
        queryClient.invalidateQueries({ queryKey: optimistic.queryKey });
      }
    },
  });
}

/**
 * Delete a Firestore document.
 * 
 * @example
 * ```tsx
 * const deletePost = useFirestoreDelete({
 *   invalidateKeys: [['posts']],
 *   optimistic: {
 *     queryKey: ['posts', 'feed'],
 *     updater: (old, docPath) => old?.filter(p => p.id !== docPath.split('/').pop()),
 *   },
 * });
 * 
 * deletePost.mutate({ docPath: `posts/${postId}` });
 * ```
 */
export function useFirestoreDelete<T = unknown>({
  invalidateKeys = [],
  optimistic,
}: {
  invalidateKeys?: readonly QueryKey[];
  optimistic?: {
    queryKey: QueryKey;
    updater: (oldData: T | undefined, docPath: string) => T;
  };
} = {}) {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docPath }: { docPath: string }) => {
      const docRef = doc(db, docPath);
      await deleteDoc(docRef);
      return docPath;
    },
    onMutate: async ({ docPath }) => {
      if (!optimistic) return;

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

/**
 * Execute multiple Firestore operations in batches.
 * Automatically chunks operations to stay within Firestore's 500 operation limit.
 * 
 * @example
 * ```tsx
 * const batchMutation = useFirestoreBatch({
 *   invalidateKeys: [['notifications']],
 * });
 * 
 * batchMutation.mutate({
 *   operations: [
 *     { type: 'update', docPath: 'posts/1', data: { read: true } },
 *     { type: 'update', docPath: 'posts/2', data: { read: true } },
 *     { type: 'delete', docPath: 'posts/3' },
 *   ],
 * });
 * ```
 */
export function useFirestoreBatch({
  invalidateKeys = [],
  batchSize = DEFAULT_BATCH_SIZE,
}: FirestoreBatchOptions = {}) {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      operations,
    }: {
      operations: MutationOperation[];
    }) => {
      // Chunk operations into batches
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
