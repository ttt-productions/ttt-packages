'use client';

import {
  createContext,
  useCallback,
  useContext,
  useInsertionEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  useMutation,
  useQueryClient,
  type DefaultError,
  type MutateOptions,
  type MutationFunctionContext,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

export interface MutationSession {
  uid: string | null;
  isCurrent(): boolean;
  assertCurrent(): void;
}

export type SessionMutationFunctionContext = MutationFunctionContext & {
  session: MutationSession;
};

export type SessionMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationFn' | 'onMutate' | 'onSuccess' | 'onError' | 'onSettled'
> & {
  mutationFn: (variables: TVariables, context: SessionMutationFunctionContext) => Promise<TData>;
  onMutate?: (
    variables: TVariables,
    context: SessionMutationFunctionContext,
  ) => Promise<TOnMutateResult> | TOnMutateResult;
  onSuccess?: (
    data: TData,
    variables: TVariables,
    onMutateResult: TOnMutateResult,
    context: SessionMutationFunctionContext,
  ) => Promise<unknown> | unknown;
  onError?: (
    error: TError,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: SessionMutationFunctionContext,
  ) => Promise<unknown> | unknown;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: SessionMutationFunctionContext,
  ) => Promise<unknown> | unknown;
  unknownOutcomeReads?: (variables: TVariables) => readonly QueryKey[];
};

export interface UnknownOutcomePolicy {
  isUnknownOutcome: (error: unknown) => boolean;
  rereadAfterMs: readonly number[];
  reread: (queryClient: QueryClient, keys: readonly QueryKey[]) => unknown;
}

export interface SessionMutateOptions<TData, TError, TVariables, TOnMutateResult> {
  onSuccess?: (
    data: TData,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: SessionMutationFunctionContext,
  ) => void;
  onError?: (
    error: TError,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: SessionMutationFunctionContext,
  ) => void;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: SessionMutationFunctionContext,
  ) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SessionMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = DistributiveOmit<
  UseMutationResult<TData, TError, TVariables, TOnMutateResult>,
  'mutate' | 'mutateAsync'
> & {
  mutate: (
    variables: TVariables,
    options?: SessionMutateOptions<TData, TError, TVariables, TOnMutateResult>,
  ) => void;
  mutateAsync: (
    variables: TVariables,
    options?: SessionMutateOptions<TData, TError, TVariables, TOnMutateResult>,
  ) => Promise<TData>;
};

export class MutationSessionEndedError extends Error {
  override name = 'AbortError';

  constructor(options?: { cause?: unknown }) {
    super('The session that started this mutation has ended.', options);
  }
}

/** The signed-in uid as the auth layer holds it right now, and a subscription to its changes —
 *  the pair `useSyncExternalStore` takes. */
export interface LiveSessionSource {
  read: () => string | null;
  subscribe: (onChange: () => void) => () => void;
}

interface SessionStore {
  current: { uid: string | null; generation: number };
  live: LiveSessionSource | null;
  unknownOutcome: UnknownOutcomePolicy | null;
}

const MutationSessionContext = createContext<SessionStore | null>(null);

export type MutationSessionProviderProps = {
  unknownOutcome?: UnknownOutcomePolicy;
  children?: ReactNode;
} & (
  | { currentUid: string | null; liveSession?: never }
  | { liveSession: LiveSessionSource; currentUid?: never }
);

function observeUid(store: SessionStore, uid: string | null): void {
  if (store.current.uid !== uid) {
    store.current = { uid, generation: store.current.generation + 1 };
  }
}

// A live source is read at every capture and every check, so an action started in the same task
// as a sign-in belongs to the new uid even before any render has seen it.
function syncLive(store: SessionStore): void {
  if (store.live) observeUid(store, store.live.read());
}

export function MutationSessionProvider(props: MutationSessionProviderProps) {
  const { unknownOutcome, children } = props;
  const live = props.liveSession ?? null;
  const currentUid = props.liveSession ? null : (props.currentUid ?? null);
  const [store] = useState<SessionStore>(() => ({
    current: { uid: live ? live.read() : currentUid, generation: 0 },
    live,
    unknownOutcome: unknownOutcome ?? null,
  }));
  // Insertion effects run before any layout effect of the commit, so a child's layout effect
  // never starts a mutation under the uid this commit ends.
  useInsertionEffect(() => {
    store.live = live;
    if (live) syncLive(store);
    else observeUid(store, currentUid);
    store.unknownOutcome = unknownOutcome ?? null;
  }, [store, live, currentUid, unknownOutcome]);
  // Every change the source reports is observed as it happens, so a sign-out followed by the same
  // uid signing back in ends the session even when no check ran in between.
  useInsertionEffect(() => {
    if (!live) return;
    return live.subscribe(() => syncLive(store));
  }, [store, live]);
  return (
    <MutationSessionContext.Provider value={store}>{children}</MutationSessionContext.Provider>
  );
}

const ALWAYS_CURRENT: MutationSession = {
  uid: null,
  isCurrent: () => true,
  assertCurrent: () => {},
};

function captureSession(store: SessionStore | null): MutationSession {
  if (!store) return ALWAYS_CURRENT;
  syncLive(store);
  const { uid, generation } = store.current;
  const isCurrent = () => {
    syncLive(store);
    return store.current.generation === generation;
  };
  return {
    uid,
    isCurrent,
    assertCurrent: () => {
      if (!isCurrent()) throw new MutationSessionEndedError();
    },
  };
}

export function useMutationSessionCapture(): () => MutationSession {
  const store = useContext(MutationSessionContext);
  return useCallback(() => captureSession(store), [store]);
}

const runSessions = new WeakMap<MutationFunctionContext, MutationSession>();

function runHasEnded(store: SessionStore | null, context: MutationFunctionContext): boolean {
  if (!store) return false;
  return !(runSessions.get(context)?.isCurrent() ?? false);
}

type Retry<TError> = UseMutationOptions<unknown, TError, unknown, unknown>['retry'];
type ThrowOnError<TError> = UseMutationOptions<unknown, TError, unknown, unknown>['throwOnError'];

function retriesAfter<TError>(retry: Retry<TError>, failureCount: number, error: TError): boolean {
  if (error instanceof MutationSessionEndedError) return false;
  if (typeof retry === 'function') return retry(failureCount, error);
  if (typeof retry === 'number') return failureCount < retry;
  return retry === true;
}

function throwsToBoundary<TError>(throwOnError: ThrowOnError<TError>, error: TError): boolean {
  if (error instanceof MutationSessionEndedError) return false;
  if (typeof throwOnError === 'function') return throwOnError(error);
  return throwOnError === true;
}

function withSession(
  context: MutationFunctionContext,
  session: MutationSession,
): SessionMutationFunctionContext {
  return { ...context, session };
}

function fenceCallOptions<TData, TError, TVariables, TOnMutateResult>(
  session: MutationSession,
  options: SessionMutateOptions<TData, TError, TVariables, TOnMutateResult> | undefined,
): MutateOptions<TData, TError, TVariables, TOnMutateResult> | undefined {
  if (!options) return undefined;
  const { onSuccess, onError, onSettled } = options;
  return {
    onSuccess: onSuccess
      ? (data, variables, onMutateResult, context) => {
          if (session.isCurrent()) {
            onSuccess(data, variables, onMutateResult, withSession(context, session));
          }
        }
      : undefined,
    onError: onError
      ? (error, variables, onMutateResult, context) => {
          if (!(error instanceof MutationSessionEndedError) && session.isCurrent()) {
            onError(error, variables, onMutateResult, withSession(context, session));
          }
        }
      : undefined,
    onSettled: onSettled
      ? (data, error, variables, onMutateResult, context) => {
          if (!(error instanceof MutationSessionEndedError) && session.isCurrent()) {
            onSettled(data, error, variables, onMutateResult, withSession(context, session));
          }
        }
      : undefined,
  };
}

function rereadOnUnknownOutcome<TVariables>(
  store: SessionStore | null,
  queryClient: QueryClient,
  reads: ((variables: TVariables) => readonly QueryKey[]) | undefined,
  error: unknown,
  variables: TVariables,
  session: MutationSession,
): void {
  const policy = store?.unknownOutcome;
  if (!policy || !reads || !policy.isUnknownOutcome(error)) return;
  const keys = reads(variables);
  if (keys.length === 0) return;
  for (const delayMs of policy.rereadAfterMs) {
    setTimeout(() => {
      if (session.isCurrent()) void policy.reread(queryClient, keys);
    }, delayMs);
  }
}

async function settleInSession<TData>(
  session: MutationSession,
  settled: Promise<TData>,
): Promise<TData> {
  let data: TData;
  try {
    data = await settled;
  } catch (error) {
    if (!(error instanceof MutationSessionEndedError) && !session.isCurrent()) {
      throw new MutationSessionEndedError({ cause: error });
    }
    throw error;
  }
  session.assertCurrent();
  return data;
}

export function useSessionMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: SessionMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): SessionMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const store = useContext(MutationSessionContext);
  const queryClient = useQueryClient();
  const {
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    retry,
    throwOnError,
    unknownOutcomeReads,
    ...rest
  } = options;
  const defaults = queryClient.defaultMutationOptions<
    UseMutationOptions<unknown, TError, unknown, unknown>
  >({ mutationKey: options.mutationKey });
  const baseRetry = (retry ?? defaults.retry) as Retry<TError>;
  const baseThrowOnError = (throwOnError ?? defaults.throwOnError) as ThrowOnError<TError>;

  const mutation = useMutation<TData, TError, TVariables, TOnMutateResult>({
    ...rest,
    retry: (failureCount, error) => retriesAfter(baseRetry, failureCount, error),
    throwOnError: (error) => throwsToBoundary(baseThrowOnError, error),
    onMutate: (variables, context) => {
      const session = store ? captureSession(store) : ALWAYS_CURRENT;
      if (store) runSessions.set(context, session);
      return onMutate?.(variables, withSession(context, session)) as
        TOnMutateResult | Promise<TOnMutateResult>;
    },
    mutationFn: async (variables, context) => {
      const session = store ? runSessions.get(context) : ALWAYS_CURRENT;
      if (!session || !session.isCurrent()) throw new MutationSessionEndedError();
      let data: TData;
      try {
        data = await mutationFn(variables, { ...context, session });
      } catch (error) {
        if (!session.isCurrent()) throw new MutationSessionEndedError({ cause: error });
        throw error;
      }
      session.assertCurrent();
      return data;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      if (runHasEnded(store, context)) return;
      return onSuccess?.(
        data,
        variables,
        onMutateResult,
        withSession(context, runSession(context)),
      );
    },
    onError: (error, variables, onMutateResult, context) => {
      if (error instanceof MutationSessionEndedError || runHasEnded(store, context)) return;
      const session = runSession(context);
      rereadOnUnknownOutcome(store, queryClient, unknownOutcomeReads, error, variables, session);
      return onError?.(error, variables, onMutateResult, withSession(context, session));
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      if (error instanceof MutationSessionEndedError || runHasEnded(store, context)) return;
      return onSettled?.(
        data,
        error,
        variables,
        onMutateResult,
        withSession(context, runSession(context)),
      );
    },
  });

  function runSession(context: MutationFunctionContext): MutationSession {
    return (store && runSessions.get(context)) || ALWAYS_CURRENT;
  }

  const { mutate: rawMutate, mutateAsync: rawMutateAsync } = mutation;
  const mutate = useCallback(
    (
      variables: TVariables,
      callOptions?: SessionMutateOptions<TData, TError, TVariables, TOnMutateResult>,
    ) => rawMutate(variables, fenceCallOptions(captureSession(store), callOptions)),
    [rawMutate, store],
  );
  const mutateAsync = useCallback(
    (
      variables: TVariables,
      callOptions?: SessionMutateOptions<TData, TError, TVariables, TOnMutateResult>,
    ) => {
      const session = captureSession(store);
      return settleInSession(
        session,
        rawMutateAsync(variables, fenceCallOptions(session, callOptions)),
      );
    },
    [rawMutateAsync, store],
  );
  return { ...mutation, mutate, mutateAsync } as SessionMutationResult<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >;
}
