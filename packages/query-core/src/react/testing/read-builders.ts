import {
  InfiniteQueryObserver,
  QueryClient,
  QueryObserver,
  type InfiniteData,
  type InfiniteQueryObserverResult,
  type QueryKey,
  type QueryObserverResult,
  type QueryState,
} from '@tanstack/react-query';
import { nextHeldFailure, toRetryState, type ReadRetryState } from '../read-retry-derivation.js';

export type BuiltRead<T> = QueryObserverResult<T, Error> & { retryState: ReadRetryState<Error> };

export type BuiltInfiniteRead<TData> = InfiniteQueryObserverResult<TData, Error> & {
  retryState: ReadRetryState<Error>;
};

const KEY: QueryKey = ['built-read'];

const notFetchedInTest = (): Promise<never> =>
  Promise.reject(new Error('this read is not fetched in the test; pass the case its own refetch'));

function retryStateOf(
  result: { error: Error | null; isFetching: boolean; isLoading: boolean; isPaused: boolean },
  held: Error | null,
): ReadRetryState<Error> {
  const source = {
    error: result.error,
    isFetching: result.isFetching,
    isLoading: result.isLoading,
    isPaused: result.isPaused,
  };
  return toRetryState(source, nextHeldFailure(held ? { error: held } : undefined, source));
}

function observed<T>(
  state: Partial<QueryState<T, Error>>,
  held: Error | null = null,
): BuiltRead<T> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.getQueryCache().build<T, Error>(client, { queryKey: KEY }).setState(state);
  const result = new QueryObserver<T, Error>(client, {
    queryKey: KEY,
    queryFn: notFetchedInTest,
    enabled: false,
  }).getCurrentResult();
  return { ...result, retryState: retryStateOf(result, held) };
}

const answered = <T>(data: T): Partial<QueryState<T, Error>> => ({
  data,
  dataUpdatedAt: 1,
  status: 'success',
});

const failure = (error: Error): Partial<QueryState<never, Error>> => ({
  error,
  errorUpdatedAt: 2,
  errorUpdateCount: 1,
  fetchFailureCount: 1,
  fetchFailureReason: error,
  status: 'error',
});

export const answeredRead = <T>(data: T): BuiltRead<T> => observed<T>(answered(data));

export const idleRead = <T>(): BuiltRead<T> => observed<T>({});

export const loadingRead = <T>(): BuiltRead<T> => observed<T>({ fetchStatus: 'fetching' });

export const failedRead = <T>(error: Error): BuiltRead<T> => observed<T>(failure(error));

export const retryingRead = <T>(error: Error): BuiltRead<T> =>
  observed<T>({ status: 'pending', fetchStatus: 'fetching', error: null }, error);

export const fetchingRead = <T>(data: T): BuiltRead<T> =>
  observed<T>({ ...answered(data), fetchStatus: 'fetching' });

export const answeredThenFailedRead = <T>(data: T, error: Error): BuiltRead<T> =>
  observed<T>({ ...answered(data), ...failure(error) });

export const retryingAnsweredRead = <T>(data: T, error: Error): BuiltRead<T> =>
  observed<T>({ ...answered(data), ...failure(error), fetchStatus: 'fetching' });

export interface InfiniteReadSpec<TPage, TParam, TData = InfiniteData<TPage, TParam>> {
  pages?: TPage[];
  pageParams?: TParam[];
  initialPageParam: TParam;
  getNextPageParam: (
    lastPage: TPage,
    allPages: TPage[],
    lastPageParam: TParam,
    allPageParams: TParam[],
  ) => TParam | undefined | null;
  select?: (data: InfiniteData<TPage, TParam>) => TData;
}

function pageParamsOf<TPage, TParam, TData>(
  spec: InfiniteReadSpec<TPage, TParam, TData>,
  pages: TPage[],
): TParam[] {
  const params = [spec.initialPageParam];
  for (let i = 1; i < pages.length; i++) {
    const next = spec.getNextPageParam(pages[i - 1], pages.slice(0, i), params[i - 1], [...params]);
    if (next === undefined || next === null)
      throw new Error(`page ${i} has no page param: getNextPageParam ends the list before it`);
    params.push(next);
  }
  return params;
}

function observedInfinite<TPage, TParam, TData>(
  spec: InfiniteReadSpec<TPage, TParam, TData>,
  state: Partial<QueryState<InfiniteData<TPage, TParam>, Error>>,
  held: Error | null = null,
): BuiltInfiniteRead<TData> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pages = spec.pages;
  client
    .getQueryCache()
    .build<InfiniteData<TPage, TParam>, Error>(client, { queryKey: KEY })
    .setState({
      ...(pages
        ? {
            data: {
              pages,
              pageParams: spec.pageParams ?? pageParamsOf(spec, pages),
            },
            dataUpdatedAt: 1,
            status: 'success',
          }
        : {}),
      ...state,
    });
  const result = new InfiniteQueryObserver<TPage, Error, TData, QueryKey, TParam>(client, {
    queryKey: KEY,
    queryFn: notFetchedInTest,
    initialPageParam: spec.initialPageParam,
    getNextPageParam: spec.getNextPageParam,
    ...(spec.select ? { select: spec.select } : {}),
    enabled: false,
  }).getCurrentResult();
  return { ...result, retryState: retryStateOf(result, held) };
}

const FORWARD = { fetchMore: { direction: 'forward' } } as const;

export const infiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
): BuiltInfiniteRead<TData> => observedInfinite(spec, {});

export const idleInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: Omit<InfiniteReadSpec<TPage, TParam, TData>, 'pages'>,
): BuiltInfiniteRead<TData> => observedInfinite(spec, {});

export const loadingInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: Omit<InfiniteReadSpec<TPage, TParam, TData>, 'pages'>,
): BuiltInfiniteRead<TData> => observedInfinite(spec, { fetchStatus: 'fetching' });

export const failedInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: Omit<InfiniteReadSpec<TPage, TParam, TData>, 'pages'>,
  error: Error,
): BuiltInfiniteRead<TData> => observedInfinite(spec, failure(error));

export const retryingInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: Omit<InfiniteReadSpec<TPage, TParam, TData>, 'pages'>,
  error: Error,
): BuiltInfiniteRead<TData> =>
  observedInfinite(spec, { status: 'pending', fetchStatus: 'fetching', error: null }, error);

export const fetchingInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
): BuiltInfiniteRead<TData> => observedInfinite(spec, { fetchStatus: 'fetching' });

export const answeredThenFailedInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
  error: Error,
): BuiltInfiniteRead<TData> => observedInfinite(spec, failure(error));

export const retryingAnsweredInfiniteRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
  error: Error,
): BuiltInfiniteRead<TData> =>
  observedInfinite(spec, { ...failure(error), fetchStatus: 'fetching' });

export const pausedRetryingAnsweredInfiniteRead = <
  TPage,
  TParam,
  TData = InfiniteData<TPage, TParam>,
>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
  error: Error,
): BuiltInfiniteRead<TData> => observedInfinite(spec, { ...failure(error), fetchStatus: 'paused' });

export const fetchingNextPageRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
): BuiltInfiniteRead<TData> =>
  observedInfinite(spec, { fetchStatus: 'fetching', fetchMeta: FORWARD });

export const nextPageFailedRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
  error: Error,
): BuiltInfiniteRead<TData> => observedInfinite(spec, { ...failure(error), fetchMeta: FORWARD });

export const retryingNextPageRead = <TPage, TParam, TData = InfiniteData<TPage, TParam>>(
  spec: InfiniteReadSpec<TPage, TParam, TData> & { pages: TPage[] },
  error: Error,
): BuiltInfiniteRead<TData> =>
  observedInfinite(spec, { ...failure(error), fetchStatus: 'fetching', fetchMeta: FORWARD });
