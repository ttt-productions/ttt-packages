'use client';

import { useCallback } from 'react';
import {
  useMutationState,
  useQueryClient,
  type MutateOptions,
  type MutationKey,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

export function usePendingMutationVariables<V>(
  mutationKey: MutationKey,
): ReadonlyArray<V | undefined> {
  return useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => mutation.state.variables as V | undefined,
  });
}

export function pendingMutationVariables<V>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
): Array<V | undefined> {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey, status: 'pending' })
    .map((mutation) => mutation.state.variables as V | undefined);
}

export function usePendingMutationTargets<V>(
  mutationKey: MutationKey,
  targetOf: (variables: V) => string | null | undefined,
): ReadonlySet<string> {
  const targets = new Set<string>();
  for (const variables of usePendingMutationVariables<V>(mutationKey)) {
    if (variables === undefined) continue;
    const target = targetOf(variables);
    if (target) targets.add(target);
  }
  return targets;
}

export function hasPendingMutation<V>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  matches?: (variables: V) => boolean,
): boolean {
  const pending = pendingMutationVariables<V>(queryClient, mutationKey);
  if (!matches) return pending.length > 0;
  return pending.some((variables) => variables !== undefined && matches(variables));
}

export function duplicateSubmissionError(what: string): Error {
  const duplicate = new Error(`${what} is already in flight.`);
  duplicate.name = 'AbortError';
  return duplicate;
}

/** `isDuplicate` must have a stable identity (declare it at module level) so the guarded callbacks keep theirs. */
export function useDuplicateGuardedMutation<TData, TError, TVariables, TContext>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
  isDuplicate: (queryClient: QueryClient, variables: TVariables) => boolean,
  what: string,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const queryClient = useQueryClient();
  const { mutate: rawMutate, mutateAsync: rawMutateAsync } = mutation;
  const mutate = useCallback(
    (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => {
      if (isDuplicate(queryClient, variables)) return;
      rawMutate(variables, options);
    },
    [queryClient, rawMutate, isDuplicate],
  );
  const mutateAsync = useCallback(
    async (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => {
      if (isDuplicate(queryClient, variables)) throw duplicateSubmissionError(what);
      return rawMutateAsync(variables, options);
    },
    [queryClient, rawMutateAsync, isDuplicate, what],
  );
  return { ...mutation, mutate, mutateAsync } as UseMutationResult<
    TData,
    TError,
    TVariables,
    TContext
  >;
}
