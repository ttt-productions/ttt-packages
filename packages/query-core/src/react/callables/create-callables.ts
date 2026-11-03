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

export interface SlowCallNotice {
  afterMs: number;
  show: (context: CallableCaptureContext) => () => void;
}

export interface CallablePolicy {
  getFunctions: FunctionsProvider;
  timeoutMs: number;
  resolveLimitedUseAppCheck: (requested: boolean) => boolean;
  captureFault: (error: unknown, context: CallableCaptureContext) => void;
  captureRecoveredFallback: (error: unknown, context: CallableCaptureContext) => void;
  onActionError: (error: unknown, routing: CallableErrorRouting) => void;
  onSlowCall: SlowCallNotice;
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

export interface Callables {
  createCallableHook<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, TResult, TOnMutateResult>,
  ) => SessionMutationResult<TResult, Error, TInput, TOnMutateResult>;
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
  function withSlowCallNotice<TResult>(
    pending: Promise<TResult>,
    functionName: string,
    session: MutationSession,
  ): Promise<TResult> {
    let dismiss: (() => void) | undefined;
    const timer = setTimeout(() => {
      if (session.isCurrent()) dismiss = policy.onSlowCall.show({ functionName });
    }, policy.onSlowCall.afterMs);
    const settle = () => {
      clearTimeout(timer);
      dismiss?.();
    };
    pending.then(settle, settle);
    return pending;
  }

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
        withSlowCallNotice(
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
          functionName,
          session,
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
