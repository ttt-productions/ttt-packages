import type { FirestoreError } from 'firebase/firestore';
import { failNext } from './listener-controls.js';
import type {
  ClientReadPredicate,
  ExecutedClientRead,
  InMemoryClientFirestore,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';

const lastSegment = (path: string): string => path.split('/').at(-1) ?? '';
const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/');

export function idsOf(read: ExecutedClientRead): string[] {
  if (read.kind === 'doc') return [lastSegment(read.path)];
  const ids: string[] = [];
  for (const filter of read.filters) {
    if (filter.field !== '__name__' || filter.value.t !== 'arr') continue;
    for (const value of filter.value.v) if (value.t === 'ref') ids.push(lastSegment(value.v));
  }
  return ids;
}

export const batchReadIn =
  (collectionPath: string): ClientReadPredicate =>
  (read) =>
    !read.listen && read.kind === 'query' && read.path === collectionPath;

export const docGetIn =
  (collectionPath: string): ClientReadPredicate =>
  (read) =>
    !read.listen && read.kind === 'doc' && parentOf(read.path) === collectionPath;

export const oneShotReadIn =
  (collectionPath: string): ClientReadPredicate =>
  (read) =>
    batchReadIn(collectionPath)(read) || docGetIn(collectionPath)(read);

export const docGetOf =
  (collectionPath: string, id: string): ClientReadPredicate =>
  (read) =>
    !read.listen && read.kind === 'doc' && read.path === `${collectionPath}/${id}`;

export const listenerOf =
  (collectionPath: string, id: string): ClientReadPredicate =>
  (read) =>
    read.listen && read.kind === 'doc' && read.path === `${collectionPath}/${id}`;

export const listenersIn =
  (collectionPath: string): ClientReadPredicate =>
  (read) =>
    read.listen && read.kind === 'doc' && parentOf(read.path) === collectionPath;

export const readsMatching = (
  store: InMemoryClientFirestore,
  predicate: ClientReadPredicate,
): ExecutedClientRead[] => store.queries().filter(predicate);

export interface HeldRead {
  readonly read: ExecutedClientRead;
  readonly ids: readonly string[];
  release(): void;
  fail(error: FirestoreError): void;
}

export interface ReadHold {
  holding: boolean;
  readonly waiting: HeldRead[];
}

export function holdReads(
  store: InMemoryClientFirestore,
  predicate: ClientReadPredicate,
  when: 'before-answer' | 'after-answer' = 'before-answer',
): ReadHold {
  const hold: ReadHold = { holding: true, waiting: [] };
  let matched: ExecutedClientRead | null = null;
  const select: ClientReadPredicate = (read) => {
    if (!hold.holding || !predicate(read)) return false;
    matched = read;
    return true;
  };
  const wait = () =>
    new Promise<void>((resolve) => {
      const read = matched;
      if (!read) throw new Error('held a read the hold never selected');
      matched = null;
      const entry: HeldRead = {
        read,
        ids: idsOf(read),
        release() {
          const index = hold.waiting.indexOf(entry);
          if (index >= 0) hold.waiting.splice(index, 1);
          resolve();
        },
        fail(error) {
          if (when === 'after-answer') throw new Error('a read already answered cannot fail');
          failNext(store, (candidate) => candidate === read, error);
          entry.release();
        },
      };
      hold.waiting.push(entry);
    });
  if (when === 'before-answer') store.beforeRead(select, wait);
  else store.afterRead(select, wait);
  return hold;
}
