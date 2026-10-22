'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { callCallable, type FunctionsProvider } from '../client/call-callable.js';
import { isRecoveredFallbackReport } from '../client/recovered-fallback.js';
import type { ExpectedCallableAnswerCode } from '../utils/expected-callable-answers.js';

export interface CallableErrorRouting {
  showErrorToast: boolean;
  answeredRefusals: readonly ExpectedCallableAnswerCode[];
  isAnswerSurfacedByCaller?: (error: unknown) => boolean;
}

export type CallableCaptureContext = Record<string, unknown>;

export interface CallablePolicy {
  getFunctions: FunctionsProvider;
  timeoutMs: number;
  resolveLimitedUseAppCheck: (requested: boolean) => boolean;
  captureFault: (error: unknown, context: CallableCaptureContext) => void;
  captureRecoveredFallback: (error: unknown, context: CallableCaptureContext) => void;
  onActionError: (error: unknown, routing: CallableErrorRouting) => void;
}

export interface CallableDeclaration {
  limitedUseAppCheck?: true;
}

interface CallableTransportOptions extends Partial<CallableErrorRouting> {
  captureFaults?: boolean;
}

export type CallableMutationOptions<TInput, TResult, TOnMutateResult = unknown> = Omit<
  UseMutationOptions<TResult, Error, TInput, TOnMutateResult>,
  'mutationFn' | 'retry'
> &
  Pick<
    CallableTransportOptions,
    'showErrorToast' | 'answeredRefusals' | 'isAnswerSurfacedByCaller' | 'captureFaults'
  >;

export const MAX_RESUMABLE_CALLS = 12;

export type ResumableOutcome<TResult> = TResult & { interruption: Error | null };

export interface Callables {
  createCallableHook<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, TResult, TOnMutateResult>,
  ) => UseMutationResult<TResult, Error, TInput, TOnMutateResult>;
  createResumableCallableHook<TInput, TResult extends { complete: boolean }>(
    functionName: string,
    merge: (earlier: TResult, later: TResult) => TResult,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, ResumableOutcome<TResult>, TOnMutateResult>,
  ) => UseMutationResult<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult>;
  createCallableReader<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
  createCallableInvoker<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
}

export function createCallables(policy: CallablePolicy): Callables {
  function useCallableTransport(
    functionName: string,
    declaration: CallableDeclaration,
    options: CallableTransportOptions,
  ): <TInput, TResult>(input: TInput) => Promise<TResult> {
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const limitedUseAppCheck = policy.resolveLimitedUseAppCheck(
      declaration.limitedUseAppCheck === true,
    );

    return useCallback(
      <TInput, TResult>(input: TInput) =>
        callCallable<TInput, TResult>(
          policy.getFunctions,
          functionName,
          input,
          {
            captureException: (error, context) => {
              if (optionsRef.current.captureFaults !== false) policy.captureFault(error, context);
              else if (isRecoveredFallbackReport(context))
                policy.captureRecoveredFallback(error, context);
            },
            onError: (error) => {
              const {
                showErrorToast = true,
                answeredRefusals = [],
                isAnswerSurfacedByCaller,
              } = optionsRef.current;
              policy.onActionError(error, {
                showErrorToast,
                answeredRefusals,
                isAnswerSurfacedByCaller,
              });
            },
          },
          { timeoutMs: policy.timeoutMs, limitedUseAppCheck },
        ),
      [functionName, limitedUseAppCheck],
    );
  }

  return {
    createCallableHook<TInput, TResult>(
      functionName: string,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedCallable<TOnMutateResult = unknown>(
        options: CallableMutationOptions<TInput, TResult, TOnMutateResult> = {},
      ): UseMutationResult<TResult, Error, TInput, TOnMutateResult> {
        const {
          showErrorToast,
          answeredRefusals,
          isAnswerSurfacedByCaller,
          captureFaults,
          ...mutationOptions
        } = options;
        const call = useCallableTransport(functionName, declaration, {
          showErrorToast,
          answeredRefusals,
          isAnswerSurfacedByCaller,
          captureFaults,
        });
        const mutationFn = useMemo(() => (input: TInput) => call<TInput, TResult>(input), [call]);
        // `retry: false` comes last so nothing overrides it: a deadline expiry is an unknown outcome,
        // and a retry after a committed first attempt writes twice.
        return useMutation<TResult, Error, TInput, TOnMutateResult>({
          ...mutationOptions,
          retry: false,
          mutationFn,
        });
      };
    },

    createResumableCallableHook<TInput, TResult extends { complete: boolean }>(
      functionName: string,
      merge: (earlier: TResult, later: TResult) => TResult,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedResumableCallable<TOnMutateResult = unknown>(
        options: CallableMutationOptions<TInput, ResumableOutcome<TResult>, TOnMutateResult> = {},
      ): UseMutationResult<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult> {
        const {
          showErrorToast,
          answeredRefusals,
          isAnswerSurfacedByCaller,
          captureFaults,
          ...mutationOptions
        } = options;
        const call = useCallableTransport(functionName, declaration, {
          showErrorToast,
          answeredRefusals,
          isAnswerSurfacedByCaller,
          captureFaults,
        });
        const mutationFn = useMemo(
          () =>
            async (input: TInput): Promise<ResumableOutcome<TResult>> => {
              let progress = await call<TInput, TResult>(input);
              for (let calls = 1; !progress.complete && calls < MAX_RESUMABLE_CALLS; calls += 1) {
                let later: TResult;
                try {
                  later = await call<TInput, TResult>(input);
                } catch (error) {
                  const interruption = error instanceof Error ? error : new Error(String(error));
                  return { ...progress, complete: false, interruption };
                }
                progress = merge(progress, later);
              }
              return { ...progress, interruption: null };
            },
          [call],
        );
        return useMutation<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult>({
          ...mutationOptions,
          retry: false,
          mutationFn,
        });
      };
    },

    createCallableReader<TInput, TResult>(
      functionName: string,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedCallableReader(): (input: TInput) => Promise<TResult> {
        const call = useCallableTransport(functionName, declaration, {
          showErrorToast: false,
          captureFaults: false,
        });
        return useMemo(() => (input: TInput) => call<TInput, TResult>(input), [call]);
      };
    },

    createCallableInvoker<TInput, TResult>(
      functionName: string,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedCallableInvoker(): (input: TInput) => Promise<TResult> {
        const call = useCallableTransport(functionName, declaration, {});
        return useMemo(() => (input: TInput) => call<TInput, TResult>(input), [call]);
      };
    },
  };
}
