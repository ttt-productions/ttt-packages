import type { FirestoreError } from 'firebase/firestore';
import type {
  ClientReadPredicate,
  InMemoryClientFirestore,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';

export const listensTo =
  (path: string): ClientReadPredicate =>
  (read) =>
    read.listen && read.path === path;

export const anyListener: ClientReadPredicate = (read) => read.listen;

export const anyOneShotRead: ClientReadPredicate = (read) => !read.listen;

export const readsOnce =
  (path: string): ClientReadPredicate =>
  (read) =>
    !read.listen && read.path === path;

export function firstMatch(predicate: ClientReadPredicate): ClientReadPredicate {
  let spent = false;
  return (read) => {
    if (spent || !predicate(read)) return false;
    spent = true;
    return true;
  };
}

export const opened = (store: InMemoryClientFirestore, predicate: ClientReadPredicate): number =>
  store.queries().filter(predicate).length;

export const lastOpened = (store: InMemoryClientFirestore, predicate: ClientReadPredicate) =>
  store.queries().filter(predicate).at(-1);

export function failNext(
  store: InMemoryClientFirestore,
  predicate: ClientReadPredicate,
  error: FirestoreError,
): void {
  store.failReads(firstMatch(predicate), error);
}

export function failUntilStopped(
  store: InMemoryClientFirestore,
  predicate: ClientReadPredicate,
  error: FirestoreError,
): () => void {
  let failing = true;
  store.failReads((read) => failing && predicate(read), error);
  return () => {
    failing = false;
  };
}

export function holdNext(
  store: InMemoryClientFirestore,
  predicate: ClientReadPredicate,
): () => void {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  store.beforeRead(firstMatch(predicate), () => held);
  return () => release();
}
