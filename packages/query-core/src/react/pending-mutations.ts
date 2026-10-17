"use client";

// Authoritative pending for interactive mutations. A mutation registers in React Query's shared
// MutationCache under a stable `mutationKey` the app declares (one key per action), and its target
// travels in the mutation's variables. Pending is read from that cache, never from one mounted
// control's `isPending`, which gives three guarantees:
//
//   1. an in-flight request survives its originating control unmounting;
//   2. a remounted control still renders pending for that target;
//   3. a second submission for the same target is refused while the first is pending.
//
// The app owns its keys, its variable shapes and what counts as the same target; this module owns
// only the mechanics.

import { useCallback } from "react";
import {
  useMutationState,
  useQueryClient,
  type MutateOptions,
  type MutationKey,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

/** The variables of every pending mutation under `mutationKey` (prefix-matched), live. */
export function usePendingMutationVariables<V>(mutationKey: MutationKey): ReadonlyArray<V | undefined> {
  return useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) => mutation.state.variables as V | undefined,
  });
}

/** The variables of every pending mutation under `mutationKey`, read once — for a duplicate guard. */
export function pendingMutationVariables<V>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
): Array<V | undefined> {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey, status: "pending" })
    .map((mutation) => mutation.state.variables as V | undefined);
}

/**
 * The targets of every pending mutation under `mutationKey`, live — for a list whose rows each
 * ask "is mine pending?" through one hook call. `targetOf` names a variables' target, or returns
 * nothing for variables without one.
 */
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

/**
 * True when a mutation under `mutationKey` is pending — any one, or with `matches`, one whose
 * variables are for the same target.
 */
export function hasPendingMutation<V>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  matches?: (variables: V) => boolean,
): boolean {
  const pending = pendingMutationVariables<V>(queryClient, mutationKey);
  if (!matches) return pending.length > 0;
  return pending.some((variables) => variables !== undefined && matches(variables));
}

/**
 * The rejection a guarded `mutateAsync` throws for a duplicate submission: an `AbortError`, the
 * shape a caller already treats as "nothing happened" rather than a failure to report.
 */
export function duplicateSubmissionError(what: string): Error {
  const duplicate = new Error(`${what} is already in flight.`);
  duplicate.name = "AbortError";
  return duplicate;
}

/**
 * Wrap a keyed mutation's `mutate` / `mutateAsync` in the cache-consulting duplicate guard:
 * `mutate` drops a duplicate silently, and `mutateAsync` rejects it with
 * {@link duplicateSubmissionError}. `isDuplicate` must have a stable identity (declare it at module
 * level) so the guarded callbacks keep theirs.
 */
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
  return { ...mutation, mutate, mutateAsync } as UseMutationResult<TData, TError, TVariables, TContext>;
}
