import type { PaginatedPage } from '../firestore/types.js';
import type { UseFirestorePaginatedResult } from '../firestore/use-firestore-paginated.js';
import type { WithId } from '../../firestore/types.js';
import type { ReadRetryState } from '../read-retry-derivation.js';
import {
  answeredRead,
  answeredThenFailedRead,
  failedRead,
  fetchingRead,
  loadingRead,
  retryingAnsweredRead,
  retryingRead,
  type BuiltRead,
} from './read-builders.js';

export type BuiltPaginatedRead<T> = UseFirestorePaginatedResult<T> & {
  retryState: ReadRetryState<Error>;
};

export interface PaginatedReadSpec {
  page?: number;
  pageSize?: number;
  hasNextPage?: boolean;
  setPage?: (page: number) => void;
}

const pageOf = <T>(items: WithId<T>[], hasMore: boolean): PaginatedPage<WithId<T>> => ({
  items,
  cursor: null,
  hasMore,
  after: null,
});

function paginated<T>(
  read: BuiltRead<PaginatedPage<WithId<T>>>,
  spec: PaginatedReadSpec,
): BuiltPaginatedRead<T> {
  const page = spec.page ?? 1;
  const setPage = spec.setPage ?? (() => {});
  return {
    ...read,
    data: read.data?.items,
    page,
    pageSize: spec.pageSize ?? 10,
    hasNextPage: spec.hasNextPage ?? false,
    hasPrevPage: page > 1,
    setPage,
    nextPage: () => setPage(page + 1),
    prevPage: () => setPage(page - 1),
  };
}

export const answeredPaginatedRead = <T>(
  items: WithId<T>[],
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> => paginated(answeredRead(pageOf(items, spec.hasNextPage ?? false)), spec);

export const loadingPaginatedRead = <T>(spec: PaginatedReadSpec = {}): BuiltPaginatedRead<T> =>
  paginated(loadingRead<PaginatedPage<WithId<T>>>(), spec);

export const failedPaginatedRead = <T>(
  error: Error,
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> => paginated(failedRead<PaginatedPage<WithId<T>>>(error), spec);

export const retryingPaginatedRead = <T>(
  error: Error,
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> => paginated(retryingRead<PaginatedPage<WithId<T>>>(error), spec);

export const answeredThenFailedPaginatedRead = <T>(
  items: WithId<T>[],
  error: Error,
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> =>
  paginated(answeredThenFailedRead(pageOf(items, spec.hasNextPage ?? false), error), spec);

export const fetchingPaginatedRead = <T>(
  items: WithId<T>[],
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> => paginated(fetchingRead(pageOf(items, spec.hasNextPage ?? false)), spec);

export const retryingAnsweredPaginatedRead = <T>(
  items: WithId<T>[],
  error: Error,
  spec: PaginatedReadSpec = {},
): BuiltPaginatedRead<T> =>
  paginated(retryingAnsweredRead(pageOf(items, spec.hasNextPage ?? false), error), spec);
