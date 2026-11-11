import {
  callableRefusalCode,
  isAppCheckConnectionFailure,
  isAppCheckTokenFailure,
  isCallableDeadlineError,
  isExpectedCallableAnswerCode,
} from '@ttt-productions/firebase-helpers';
import {
  isRecoveredFallbackReport,
  type FunctionsProvider,
} from '@ttt-productions/firebase-helpers/client';
import type {
  CallableCaptureContext,
  CallableErrorRouting,
  CallablePolicy,
} from './create-callables.js';

export interface CallableToastConfig {
  title: string;
  description: string;
}

export interface CallableWording<TToast extends CallableToastConfig> {
  notSent: TToast;
  connectionDropped: TToast;
  tokenRefused: TToast;
  outcomeUnknown: TToast;
  maintenance: TToast;
  genericError: TToast;
  stillWorking: TToast;
}

export interface CallableBusinessAnswer {
  recognise: (error: unknown) => boolean;
  respond: (error: unknown) => void;
}

export interface CallableRefusalRecognisers {
  isPlatformTokenRefusal: (error: unknown) => boolean;
  isMaintenanceRefusal: (error: unknown) => boolean;
}

export interface CallablePolicyPlumbing<TToast extends CallableToastConfig> {
  getFunctions: FunctionsProvider;
  showToast: (toast: TToast) => { dismiss: () => void };
  captureException: (error: unknown, context: CallableCaptureContext) => void;
  captureMessage: (message: string, level: 'warning', context: CallableCaptureContext) => void;
  limitedUseAppCheck: () => boolean;
}

export interface CallablePolicyDefinition<TToast extends CallableToastConfig> {
  deadlineMs: number;
  slowCallAfterMs: number;
  wording: CallableWording<TToast>;
  businessAnswers: readonly CallableBusinessAnswer[];
  refusals: CallableRefusalRecognisers;
  plumbing: CallablePolicyPlumbing<TToast>;
}

export interface CallablePolicyKit {
  policy: CallablePolicy;
  describeCallableError: (error: unknown, fallback?: string) => string;
  captureCallableFault: (error: unknown, context?: CallableCaptureContext) => void;
  isCallableRejection: (error: unknown) => boolean;
  isExpectedCallableAnswer: (error: unknown) => boolean;
  isAnswerSurfacedElsewhere: (error: unknown) => boolean;
  callableRejectionMessage: (error: unknown) => string;
  callableRefusalMessage: (error: unknown) => string | null;
}

type FailureClass =
  'connection-dropped' | 'not-sent' | 'token-refused' | 'outcome-unknown' | 'maintenance' | 'other';

export const CALLABLE_FAULT_REPORTS = {
  recoveredFallback: 'callable recovered from an App Check throttle via the standard token',
  neverSent: 'callable never sent: App Check throttled it or its token could not be obtained',
  tokenRefused: 'callable refused by the platform: its ID or App Check token was not accepted',
} as const;

export function createCallablePolicy<TToast extends CallableToastConfig>(
  definition: CallablePolicyDefinition<TToast>,
): CallablePolicyKit {
  const { wording, businessAnswers, refusals, plumbing } = definition;
  const routedFailures = new WeakSet<object>();

  function isCallableRejection(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && routedFailures.has(error)) return true;
    return isServerRejection(error);
  }

  function businessAnswerFor(error: unknown): CallableBusinessAnswer | undefined {
    return businessAnswers.find((answer) => answer.recognise(error));
  }

  function isAnswerSurfacedElsewhere(error: unknown): boolean {
    return businessAnswerFor(error) !== undefined;
  }

  function isExpectedCallableAnswer(error: unknown): boolean {
    if (isAnswerSurfacedElsewhere(error)) return true;
    if (refusals.isPlatformTokenRefusal(error)) return false;
    return (
      isExpectedCallableAnswerCode((error as { code?: unknown } | null)?.code) ||
      refusals.isMaintenanceRefusal(error)
    );
  }

  function classify(error: unknown): FailureClass {
    if (isAppCheckConnectionFailure(error)) return 'connection-dropped';
    if (isAppCheckTokenFailure(error)) return 'not-sent';
    if (isCallableRejection(error) && refusals.isPlatformTokenRefusal(error))
      return 'token-refused';
    if (isCallableDeadlineError(error)) return 'outcome-unknown';
    if (refusals.isMaintenanceRefusal(error)) return 'maintenance';
    return 'other';
  }

  function serverMessage(error: unknown): string {
    const message = (error as { message?: unknown } | null)?.message;
    if (typeof message !== 'string') return '';
    // The client SDK appends the HTTP status to a rejection's message.
    return message.replace(/ \[\d{3}\]$/, '');
  }

  function isServerRejection(error: unknown): boolean {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && code.startsWith('functions/');
  }

  function callableRejectionMessage(error: unknown): string {
    return isServerRejection(error) ? serverMessage(error) : '';
  }

  function callableRefusalMessage(error: unknown): string | null {
    if (!isExpectedCallableAnswerCode((error as { code?: unknown } | null)?.code)) return null;
    return callableRejectionMessage(error) || null;
  }

  function maintenanceToast(error: unknown): TToast {
    const message = serverMessage(error);
    return message ? { ...wording.maintenance, description: message } : wording.maintenance;
  }

  function describeCallableError(
    error: unknown,
    fallback: string = wording.genericError.description,
  ): string {
    switch (classify(error)) {
      case 'connection-dropped':
        return wording.connectionDropped.description;
      case 'not-sent':
        return wording.notSent.description;
      case 'token-refused':
        return wording.tokenRefused.description;
      case 'outcome-unknown':
        return wording.outcomeUnknown.description;
      case 'maintenance':
        return maintenanceToast(error).description;
      case 'other':
        return callableRejectionMessage(error) || fallback;
    }
  }

  function captureCallableFault(error: unknown, context: CallableCaptureContext = {}): void {
    if (isRecoveredFallbackReport(context)) {
      plumbing.captureMessage(CALLABLE_FAULT_REPORTS.recoveredFallback, 'warning', context);
      return;
    }
    if (isExpectedCallableAnswer(error)) return;
    switch (classify(error)) {
      case 'connection-dropped':
        return;
      case 'not-sent':
        plumbing.captureMessage(CALLABLE_FAULT_REPORTS.neverSent, 'warning', {
          ...context,
          appCheckCode: (error as { code?: unknown }).code,
        });
        return;
      case 'token-refused':
        plumbing.captureMessage(CALLABLE_FAULT_REPORTS.tokenRefused, 'warning', context);
        return;
      default:
        plumbing.captureException(error, context);
    }
  }

  function routeCallableFailure(error: unknown, routing: CallableErrorRouting): void {
    if (routing.isAnswerSurfacedByCaller?.(error)) return;
    const businessAnswer = businessAnswerFor(error);
    if (businessAnswer) {
      businessAnswer.respond(error);
      return;
    }
    if (!routing.showErrorToast) return;
    const refusal = callableRefusalCode(error);
    if (refusal !== null && routing.answeredRefusals.includes(refusal)) return;
    switch (classify(error)) {
      case 'connection-dropped':
        plumbing.showToast(wording.connectionDropped);
        return;
      case 'not-sent':
        plumbing.showToast(wording.notSent);
        return;
      case 'token-refused':
        plumbing.showToast(wording.tokenRefused);
        return;
      case 'outcome-unknown':
        plumbing.showToast(wording.outcomeUnknown);
        return;
      case 'maintenance':
        plumbing.showToast(maintenanceToast(error));
        return;
      case 'other':
        plumbing.showToast({ ...wording.genericError, description: describeCallableError(error) });
    }
  }

  const policy: CallablePolicy = {
    getFunctions: plumbing.getFunctions,
    timeoutMs: definition.deadlineMs,
    resolveLimitedUseAppCheck: (requested) => requested && plumbing.limitedUseAppCheck(),
    captureFault: captureCallableFault,
    captureRecoveredFallback: (error, context) => {
      if (isRecoveredFallbackReport(context)) captureCallableFault(error, context);
    },
    onActionError: (error, routing) => {
      if (typeof error === 'object' && error !== null) routedFailures.add(error);
      routeCallableFailure(error, routing);
    },
    onSlowCall: {
      afterMs: definition.slowCallAfterMs,
      show: () => plumbing.showToast(wording.stillWorking).dismiss,
    },
  };

  return {
    policy,
    describeCallableError,
    captureCallableFault,
    isCallableRejection,
    isExpectedCallableAnswer,
    isAnswerSurfacedElsewhere,
    callableRejectionMessage,
    callableRefusalMessage,
  };
}
