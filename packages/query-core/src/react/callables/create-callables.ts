'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { ExpectedCallableAnswerCode } from '@ttt-productions/firebase-helpers';
import {
  callCallable,
  isRecoveredFallbackReport,
  type FunctionsProvider,
} from '@ttt-productions/firebase-helpers/client';
import {
  useMutationSessionCapture,
  useSessionMutation,
  type MutationSession,
  type SessionMutationOptions,
  type SessionMutationResult,
} from '../session-mutation.js';

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
  SessionMutationOptions<TResult, Error, TInput, TOnMutateResult>,
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
  ) => SessionMutationResult<TResult, Error, TInput, TOnMutateResult>;
  createResumableCallableHook<TInput, TResult extends { complete: boolean }>(
    functionName: string,
    merge: (earlier: TResult, later: TResult) => TResult,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, ResumableOutcome<TResult>, TOnMutateResult>,
  ) => SessionMutationResult<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult>;
  createCallableReader<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
  createCallableInvoker<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
}

type CallableTransport = <TInput, TResult>(
  input: TInput,
  session: MutationSession,
) => Promise<TResult>;

export function createCallables(policy: CallablePolicy): Callables {
  function useCallableTransport(
    functionName: string,
    declaration: CallableDeclaration,
    options: CallableTransportOptions,
  ): CallableTransport {
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const limitedUseAppCheck = policy.resolveLimitedUseAppCheck(
      declaration.limitedUseAppCheck === true,
    );

    return useCallback(
      <TInput, TResult>(input: TInput, session: MutationSession) =>
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
              if (!session.isCurrent()) return;
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

  function useSessionBoundCall<TInput, TResult>(
    call: CallableTransport,
  ): (input: TInput) => Promise<TResult> {
    const captureSession = useMutationSessionCapture();
    return useMemo(
      () => (input: TInput) => call<TInput, TResult>(input, captureSession()),
      [call, captureSession],
    );
  }

  return {
    createCallableHook<TInput, TResult>(
      functionName: string,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedCallable<TOnMutateResult = unknown>(
        options: CallableMutationOptions<TInput, TResult, TOnMutateResult> = {},
      ): SessionMutationResult<TResult, Error, TInput, TOnMutateResult> {
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
        // `retry: false` comes last so nothing overrides it: a deadline expiry is an unknown outcome,
        // and a retry after a committed first attempt writes twice.
        return useSessionMutation<TResult, Error, TInput, TOnMutateResult>({
          ...mutationOptions,
          retry: false,
          mutationFn: (input, { session }) => call<TInput, TResult>(input, session),
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
      ): SessionMutationResult<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult> {
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
        return useSessionMutation<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult>({
          ...mutationOptions,
          retry: false,
          mutationFn: async (input, { session }): Promise<ResumableOutcome<TResult>> => {
            let progress = await call<TInput, TResult>(input, session);
            for (let calls = 1; !progress.complete && calls < MAX_RESUMABLE_CALLS; calls += 1) {
              session.assertCurrent();
              let later: TResult;
              try {
                later = await call<TInput, TResult>(input, session);
              } catch (error) {
                const interruption = error instanceof Error ? error : new Error(String(error));
                return { ...progress, complete: false, interruption };
              }
              progress = merge(progress, later);
            }
            return { ...progress, interruption: null };
          },
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
        return useSessionBoundCall<TInput, TResult>(call);
      };
    },

    createCallableInvoker<TInput, TResult>(
      functionName: string,
      declaration: CallableDeclaration = {},
    ) {
      return function useNamedCallableInvoker(): (input: TInput) => Promise<TResult> {
        const call = useCallableTransport(functionName, declaration, {});
        return useSessionBoundCall<TInput, TResult>(call);
      };
    },
  };
}
