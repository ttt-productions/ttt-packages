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

/**
 * What a call site says about how its failure surfaces. The policy's `onActionError` receives it,
 * defaults applied, on every failure of every kind; the package itself shows nothing.
 */
export interface CallableErrorRouting {
  /**
   * Show the shared error toast on failure. Default true. A surface that renders the refusal
   * inside its own form passes false — never a licence to swallow the error, which is re-thrown
   * either way. A reader always passes false.
   */
  showErrorToast: boolean;
  /**
   * Designed refusals the caller turns into an answer of its own, so they show no toast. Any
   * other failure keeps the standard handling. Default empty.
   */
  answeredRefusals: readonly ExpectedCallableAnswerCode[];
  /**
   * A server answer the caller surfaces itself, told apart per error rather than by its code
   * alone. The shared toast never shows a rejection this matches.
   */
  isAnswerSurfacedByCaller?: (error: unknown) => boolean;
}

/** Bounded metadata `callCallable` reports with — never the request payload. */
export type CallableCaptureContext = Record<string, unknown>;

/**
 * Everything app-specific about calling the app's callables, supplied once. The package names no
 * app copy and imports no toast or monitoring module (QUALITY-102): the app binds them here.
 */
export interface CallablePolicy {
  /** The app's Functions instance (lazy, may answer none where Functions is unavailable). */
  getFunctions: FunctionsProvider;
  /** The total-invocation deadline every call runs under. */
  timeoutMs: number;
  /**
   * The effective limited-use App Check mode for a callable declared `limitedUseAppCheck` (true)
   * or not (false) — an app suppresses the per-call mint where its environment cannot serve it.
   */
  resolveLimitedUseAppCheck: (requested: boolean) => boolean;
  /**
   * The capture for a call whose kind owns its failure capture: every report `callCallable`
   * makes — the failure, and the informational recovered-fallback report
   * (`limitedUseAppCheckFallback: true`) — reaches it, and the app classifies.
   */
  captureFault: (error: unknown, context: CallableCaptureContext) => void;
  /**
   * The capture for a call whose failure another layer captures (a reader, or `captureFaults:
   * false`). It receives only the recovered-fallback report, which no other layer ever sees
   * because that call succeeded; a failure of such a call never reaches it.
   */
  captureRecoveredFallback: (error: unknown, context: CallableCaptureContext) => void;
  /** The app's surface for a failed call, given the call site's routing. */
  onActionError: (error: unknown, routing: CallableErrorRouting) => void;
}

/** How a callable is declared, beside its name — fixed per callable, never per call site. */
export interface CallableDeclaration {
  /**
   * Present a single-use App Check token minted per invocation, for a callable whose server
   * options consume the token. Never a blanket default: each call pays an attestation round trip.
   */
  limitedUseAppCheck?: true;
}

interface CallableTransportOptions extends Partial<CallableErrorRouting> {
  /**
   * Capture an unexpected fault here. Default true. False where another layer owns the capture —
   * a read's query reporter, or a caller that re-sends on a fault and captures the final failure
   * once itself.
   */
  captureFaults?: boolean;
}

/**
 * Mutation options an action accepts — everything but the `mutationFn` and `retry` (an action
 * never retries), plus the call site's routing and `captureFaults`. What `onMutate` returns reaches that call's `onError` /
 * `onSettled`.
 */
export type CallableMutationOptions<TInput, TResult, TOnMutateResult = unknown> = Omit<
  UseMutationOptions<TResult, Error, TInput, TOnMutateResult>,
  'mutationFn' | 'retry'
> &
  Pick<
    CallableTransportOptions,
    'showErrorToast' | 'answeredRefusals' | 'isAnswerSurfacedByCaller' | 'captureFaults'
  >;

/**
 * The most calls a resumable callable makes for one request. A request this long has been
 * running for minutes; the caller answers with what is still left rather than spinning on.
 */
export const MAX_RESUMABLE_CALLS = 12;

/**
 * What one request of a resumable callable settles on: every call's answer, merged — so work an
 * earlier call committed is never lost behind a later answer — and, when a call after the first
 * failed, that failure. A failure on the first call rejects the mutation: nothing is known to have
 * committed. A failure on a later one settles on the progress so far, never `complete`, beside the
 * failure, which the policy has already surfaced.
 */
export type ResumableOutcome<TResult> = TResult & { interruption: Error | null };

/** The four callable kinds, bound to one app's policy. */
export interface Callables {
  /** An action: a mutation hook that never retries, surfaces its failure, and captures it once. */
  createCallableHook<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, TResult, TOnMutateResult>,
  ) => UseMutationResult<TResult, Error, TInput, TOnMutateResult>;
  /**
   * Work the server does a budget at a time: one request calls again with the same input until
   * the answer is `complete` or `MAX_RESUMABLE_CALLS` is reached, `merge` folding each later
   * answer into the earlier ones. The mutation stays pending across every call.
   */
  createResumableCallableHook<TInput, TResult extends { complete: boolean }>(
    functionName: string,
    merge: (earlier: TResult, later: TResult) => TResult,
    declaration?: CallableDeclaration,
  ): <TOnMutateResult = unknown>(
    options?: CallableMutationOptions<TInput, ResumableOutcome<TResult>, TOnMutateResult>,
  ) => UseMutationResult<ResumableOutcome<TResult>, Error, TInput, TOnMutateResult>;
  /**
   * A read: the function a query's `queryFn` calls. Its failure renders through the read's own
   * error state and is captured once by the query layer, so it shows no toast and captures no
   * fault here (QUALITY-103).
   */
  createCallableReader<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
  /**
   * A call a package hook drives inside a mutation of its own: its failure surfaces and is
   * captured once here, and the call still rejects so that mutation settles on it.
   */
  createCallableInvoker<TInput, TResult>(
    functionName: string,
    declaration?: CallableDeclaration,
  ): () => (input: TInput) => Promise<TResult>;
}

/**
 * Builds an app's callable factories from its policy. Each named callable is declared once,
 * through one of the four kinds, and the kind fixes its retry, surface, and capture.
 */
export function createCallables(policy: CallablePolicy): Callables {
  function useCallableTransport(
    functionName: string,
    declaration: CallableDeclaration,
    options: CallableTransportOptions,
  ): <TInput, TResult>(input: TInput) => Promise<TResult> {
    // The latest call-site options are read at failure time, so the returned function stays
    // stable across renders.
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
        // `retry: false` is declared after the call site's options so nothing overrides it: a deadline
        // expiry is an UNKNOWN outcome, and a retried mutation whose first attempt may already
        // have committed is a second write nobody asked for.
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
                // Only the call is caught: a failed call after the first is an interruption the
                // policy has already surfaced, while a `merge` that throws is a fault in the app's
                // own code and rejects the request.
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
