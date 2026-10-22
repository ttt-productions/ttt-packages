import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import React from 'react';
import {
  duplicateSubmissionError,
  hasPendingMutation,
  pendingMutationVariables,
  useDuplicateGuardedMutation,
  usePendingMutationTargets,
  usePendingMutationVariables,
} from '../../src/react/pending-mutations.js';

const SAVE_KEY = ['test-mutation', 'save'] as const;
const OTHER_KEY = ['test-mutation', 'other'] as const;

interface SaveVariables {
  userId: string;
  itemId: string;
}

function makeServer() {
  const waiting: Array<() => void> = [];
  const save = vi.fn(
    (_variables: SaveVariables) =>
      new Promise<string>((resolve) => {
        waiting.push(() => resolve('saved'));
      }),
  );
  const settleAll = () => {
    while (waiting.length) waiting.shift()!();
  };
  return { save, settleAll };
}

function makeClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

function wrapperFor(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'PendingMutationsTestWrapper';
  return Wrapper;
}

const isDuplicateSave = (queryClient: QueryClient, variables: SaveVariables) =>
  hasPendingMutation<SaveVariables>(
    queryClient,
    SAVE_KEY,
    (pending) => pending.userId === variables.userId && pending.itemId === variables.itemId,
  );

function useGuardedSave(save: (variables: SaveVariables) => Promise<string>) {
  const mutation = useMutation({ mutationKey: SAVE_KEY, mutationFn: save });
  return useDuplicateGuardedMutation(mutation, isDuplicateSave, 'Saving this item');
}

describe('pending mutations', () => {
  it('an in-flight mutation stays pending after the control that started it unmounts, and a remounted reader sees it', async () => {
    const queryClient = makeClient();
    const server = makeServer();
    const control = renderHook(() => useGuardedSave(server.save), {
      wrapper: wrapperFor(queryClient),
    });
    act(() => control.result.current.mutate({ userId: 'u1', itemId: 'a' }));
    await waitFor(() => expect(server.save).toHaveBeenCalledTimes(1));
    control.unmount();

    const reader = renderHook(
      () => usePendingMutationTargets<SaveVariables>(SAVE_KEY, (v) => v.itemId),
      { wrapper: wrapperFor(queryClient) },
    );
    expect(reader.result.current.has('a')).toBe(true);
    expect(hasPendingMutation(queryClient, SAVE_KEY)).toBe(true);

    await act(async () => server.settleAll());
    await waitFor(() => expect(reader.result.current.size).toBe(0));
    expect(hasPendingMutation(queryClient, SAVE_KEY)).toBe(false);
  });

  it('a second submission for the same target is dropped by mutate and refused by mutateAsync while the first is pending', async () => {
    const queryClient = makeClient();
    const server = makeServer();
    const { result } = renderHook(() => useGuardedSave(server.save), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => result.current.mutate({ userId: 'u1', itemId: 'a' }));
    await waitFor(() => expect(server.save).toHaveBeenCalledTimes(1));
    act(() => result.current.mutate({ userId: 'u1', itemId: 'a' }));
    await expect(result.current.mutateAsync({ userId: 'u1', itemId: 'a' })).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Saving this item is already in flight.',
    });
    expect(server.save).toHaveBeenCalledTimes(1);

    await act(async () => server.settleAll());
  });

  it('a submission for another target runs while the first is pending, and the same target runs again once it settles', async () => {
    const queryClient = makeClient();
    const server = makeServer();
    const { result } = renderHook(() => useGuardedSave(server.save), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => result.current.mutate({ userId: 'u1', itemId: 'a' }));
    act(() => result.current.mutate({ userId: 'u1', itemId: 'b' }));
    await waitFor(() => expect(server.save).toHaveBeenCalledTimes(2));

    await act(async () => server.settleAll());
    await waitFor(() => expect(hasPendingMutation(queryClient, SAVE_KEY)).toBe(false));
    act(() => result.current.mutate({ userId: 'u1', itemId: 'a' }));
    await waitFor(() => expect(server.save).toHaveBeenCalledTimes(3));
    await act(async () => server.settleAll());
  });

  it('reads only the pending mutations under its own key, prefix-matched', async () => {
    const queryClient = makeClient();
    const server = makeServer();
    const { result } = renderHook(
      () => {
        const scoped = useMutation({
          mutationKey: [...SAVE_KEY, 'scope-1'],
          mutationFn: server.save,
        });
        const other = useMutation({ mutationKey: OTHER_KEY, mutationFn: server.save });
        const all = usePendingMutationVariables<SaveVariables>(SAVE_KEY);
        const scope2 = usePendingMutationVariables<SaveVariables>([...SAVE_KEY, 'scope-2']);
        return { scoped, other, all, scope2 };
      },
      { wrapper: wrapperFor(queryClient) },
    );

    act(() => {
      result.current.scoped.mutate({ userId: 'u1', itemId: 'a' });
      result.current.other.mutate({ userId: 'u1', itemId: 'z' });
    });
    await waitFor(() => expect(result.current.all).toEqual([{ userId: 'u1', itemId: 'a' }]));
    expect(result.current.scope2).toEqual([]);
    expect(pendingMutationVariables<SaveVariables>(queryClient, OTHER_KEY)).toEqual([
      { userId: 'u1', itemId: 'z' },
    ]);

    await act(async () => server.settleAll());
  });

  it('a settled mutation is never pending, whether it succeeded or failed', async () => {
    const queryClient = makeClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationKey: SAVE_KEY,
          mutationFn: async () => {
            throw new Error('refused');
          },
        }),
      { wrapper: wrapperFor(queryClient) },
    );
    await act(async () => {
      await result.current
        .mutateAsync({ userId: 'u1', itemId: 'a' } as never)
        .catch(() => undefined);
    });
    expect(hasPendingMutation(queryClient, SAVE_KEY)).toBe(false);
  });

  it('the duplicate rejection is an AbortError naming what is in flight', () => {
    const error = duplicateSubmissionError('Liking this post');
    expect(error.name).toBe('AbortError');
    expect(error.message).toBe('Liking this post is already in flight.');
  });
});
