import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import type { WithId, FirestoreBaseOptions } from '../../firestore/types.js';

export function docWithId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { id: snap.id, ...snap.data() };
}

export interface FirestoreDocOptions<T> extends FirestoreBaseOptions {
  docPath: string;
  subscribe?: boolean;
  select?: (data: DocumentData & { id: string }) => T;
}

export interface FirestoreCollectionOptions<T> extends FirestoreBaseOptions {
  collectionPath: string;
  constraints?: QueryConstraint[];
  subscribe?: boolean;
  select?: (data: DocumentData & { id: string }) => T;
}

export interface FirestoreInfiniteOptions<T> extends FirestoreBaseOptions {
  collectionPath: string;
  constraints?: QueryConstraint[];
  pageSize?: number;
  select?: (data: DocumentData & { id: string }) => T;
}

export interface FirestorePaginatedOptions<T> extends FirestoreBaseOptions {
  collectionPath: string;
  constraints?: QueryConstraint[];
  pageSize?: number;
  initialPage?: number;
  refetchInterval?: number;
  select?: (data: DocumentData & { id: string }) => T;
}

export interface FirestoreCountOptions extends FirestoreBaseOptions {
  collectionPath: string;
  constraints?: QueryConstraint[];
  refetchInterval?: number;
}

export interface FirestoreLiveInfiniteOptions<T = DocumentData & { id: string }> {
  collectionPath: string;
  queryKey: readonly unknown[];
  orderByField: string;
  constraints?: QueryConstraint[];
  pageSize?: number;
  enabled?: boolean;
  select?: (data: DocumentData & { id: string }) => T;
  sort?: 'asc' | 'desc';
}

export interface InfinitePage<T> {
  items: WithId<T>[];
  lastDoc: DocumentSnapshot | null;
  size: number;
}

export interface PaginatedPage<T> {
  items: T[];
  cursor: DocumentSnapshot | null;
  hasMore: boolean;
  after: string | null;
}

export type MutationOperation =
  | { type: 'set'; docPath: string; data: DocumentData; merge?: boolean }
  | { type: 'update'; docPath: string; data: DocumentData }
  | { type: 'delete'; docPath: string };
