import { MutationObserver, QueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SessionMutationResult } from '../session-mutation.js';

export interface MutationHandlers<TData, TVariables> {
  mutate?: UseMutationResult<TData, Error, TVariables>['mutate'];
  mutateAsync?: UseMutationResult<TData, Error, TVariables>['mutateAsync'];
}

export interface SessionMutationHandlers<TData, TVariables> {
  mutate?: SessionMutationResult<TData, Error, TVariables>['mutate'];
  mutateAsync?: SessionMutationResult<TData, Error, TVariables>['mutateAsync'];
}

const notRunInTest = (): Promise<never> =>
  Promise.reject(new Error('this mutation is not run in the test; pass the case its own handler'));

function observedMutation<TData, TVariables>(variables?: { value: TVariables }) {
  const observer = new MutationObserver<TData, Error, TVariables>(
    new QueryClient(),
    variables ? { mutationFn: () => new Promise<TData>(() => {}) } : {},
  );
  if (variables) void observer.mutate(variables.value);
  return observer.getCurrentResult();
}

export function idleMutation<TData, TVariables>(
  handlers: MutationHandlers<TData, TVariables> = {},
): UseMutationResult<TData, Error, TVariables> {
  return {
    ...observedMutation<TData, TVariables>(),
    mutate: handlers.mutate ?? (() => {}),
    mutateAsync: handlers.mutateAsync ?? notRunInTest,
  };
}

export function pendingMutation<TData, TVariables>(
  variables: TVariables,
  handlers: MutationHandlers<TData, TVariables> = {},
): UseMutationResult<TData, Error, TVariables> {
  return {
    ...observedMutation<TData, TVariables>({ value: variables }),
    mutate: handlers.mutate ?? (() => {}),
    mutateAsync: handlers.mutateAsync ?? notRunInTest,
  };
}

function asSession<TData, TVariables>(
  result: UseMutationResult<TData, Error, TVariables>,
  handlers: SessionMutationHandlers<TData, TVariables>,
): SessionMutationResult<TData, Error, TVariables> {
  return {
    ...result,
    mutate: handlers.mutate ?? (() => {}),
    mutateAsync: handlers.mutateAsync ?? notRunInTest,
  };
}

export const idleSessionMutation = <TData, TVariables>(
  handlers: SessionMutationHandlers<TData, TVariables> = {},
): SessionMutationResult<TData, Error, TVariables> =>
  asSession(idleMutation<TData, TVariables>(), handlers);

export const pendingSessionMutation = <TData, TVariables>(
  variables: TVariables,
  handlers: SessionMutationHandlers<TData, TVariables> = {},
): SessionMutationResult<TData, Error, TVariables> =>
  asSession(pendingMutation<TData, TVariables>(variables), handlers);
