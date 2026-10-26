import {
  MutationObserver,
  QueryClient,
  type DefaultError,
  type MutationObserverResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { SessionMutationFunctionContext, SessionMutationResult } from '../session-mutation.js';

export interface MutationHandlers<
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
> {
  mutate?: UseMutationResult<TData, TError, TVariables, TOnMutateResult>['mutate'];
  mutateAsync?: UseMutationResult<TData, TError, TVariables, TOnMutateResult>['mutateAsync'];
}

export interface SessionMutationHandlers<
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
> {
  mutate?: SessionMutationResult<TData, TError, TVariables, TOnMutateResult>['mutate'];
  mutateAsync?: SessionMutationResult<TData, TError, TVariables, TOnMutateResult>['mutateAsync'];
}

const notRunInTest = (): Promise<never> =>
  Promise.reject(new Error('this mutation is not run in the test; pass the case its own handler'));

function observer<TData, TVariables, TOnMutateResult, TError>(mutationFn?: () => Promise<TData>) {
  return new MutationObserver<TData, TError, TVariables, TOnMutateResult>(
    new QueryClient(),
    mutationFn ? { mutationFn } : {},
  );
}

function withHandlers<TData, TVariables, TOnMutateResult, TError>(
  result: MutationObserverResult<TData, TError, TVariables, TOnMutateResult>,
  handlers: MutationHandlers<TData, TVariables, TOnMutateResult, TError>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return {
    ...result,
    mutate: handlers.mutate ?? (() => {}),
    mutateAsync: handlers.mutateAsync ?? notRunInTest,
  };
}

export function idleMutation<TData, TVariables, TOnMutateResult = unknown, TError = DefaultError>(
  handlers: MutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const idle = observer<TData, TVariables, TOnMutateResult, TError>();
  return withHandlers(idle.getCurrentResult(), handlers);
}

export function pendingMutation<
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
>(
  variables: TVariables,
  handlers: MutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const running = observer<TData, TVariables, TOnMutateResult, TError>(
    () => new Promise<TData>(() => {}),
  );
  void running.mutate(variables);
  return withHandlers(running.getCurrentResult(), handlers);
}

export async function failedMutation<
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
>(
  error: TError,
  variables: TVariables,
  handlers: MutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): Promise<UseMutationResult<TData, TError, TVariables, TOnMutateResult>> {
  const failing = observer<TData, TVariables, TOnMutateResult, TError>(() => Promise.reject(error));
  // The rejection is the failed state this builder returns.
  await failing.mutate(variables).catch(() => undefined);
  return withHandlers(failing.getCurrentResult(), handlers);
}

function asSession<TData, TVariables, TOnMutateResult, TError>(
  result: UseMutationResult<TData, TError, TVariables, TOnMutateResult>,
  handlers: SessionMutationHandlers<TData, TVariables, TOnMutateResult, TError>,
): SessionMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return {
    ...result,
    mutate: handlers.mutate ?? (() => {}),
    mutateAsync: handlers.mutateAsync ?? notRunInTest,
  };
}

export const idleSessionMutation = <
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
>(
  handlers: SessionMutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): SessionMutationResult<TData, TError, TVariables, TOnMutateResult> =>
  asSession(idleMutation<TData, TVariables, TOnMutateResult, TError>(), handlers);

export const pendingSessionMutation = <
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
>(
  variables: TVariables,
  handlers: SessionMutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): SessionMutationResult<TData, TError, TVariables, TOnMutateResult> =>
  asSession(pendingMutation<TData, TVariables, TOnMutateResult, TError>(variables), handlers);

export const failedSessionMutation = async <
  TData,
  TVariables,
  TOnMutateResult = unknown,
  TError = DefaultError,
>(
  error: TError,
  variables: TVariables,
  handlers: SessionMutationHandlers<TData, TVariables, TOnMutateResult, TError> = {},
): Promise<SessionMutationResult<TData, TError, TVariables, TOnMutateResult>> =>
  asSession(
    await failedMutation<TData, TVariables, TOnMutateResult, TError>(error, variables),
    handlers,
  );

export function sessionMutationContext(uid: string | null): SessionMutationFunctionContext {
  return {
    client: new QueryClient(),
    meta: undefined,
    session: { uid, isCurrent: () => true, assertCurrent: () => {} },
  };
}
