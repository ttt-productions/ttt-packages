// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpsCallable, type Functions } from 'firebase/functions';
import { callableRefusalReason } from '@ttt-productions/firebase-helpers';
import {
  CALLABLE_FAULT_REPORTS,
  createCallablePolicy,
  type CallableBusinessAnswer,
  type CallablePolicyDefinition,
  type CallablePolicyPlumbing,
  type CallableToastConfig,
  type CallableWording,
} from '../../src/react/callables/create-callable-policy.js';
import {
  createCallables,
  type CallableErrorRouting,
} from '../../src/react/callables/create-callables.js';

interface Toast extends CallableToastConfig {
  variant: 'default' | 'destructive';
}

const WORDING: CallableWording<Toast> = {
  notSent: { title: 'Not sent', description: 'not-sent words', variant: 'destructive' },
  connectionDropped: {
    title: 'Connection dropped',
    description: 'connection-dropped words',
    variant: 'destructive',
  },
  tokenRefused: { title: 'Refused', description: 'token-refused words', variant: 'destructive' },
  outcomeUnknown: { title: 'Unknown', description: 'outcome-unknown words', variant: 'default' },
  maintenance: { title: 'Maintenance', description: 'maintenance words', variant: 'default' },
  genericError: { title: 'Error', description: 'generic words', variant: 'destructive' },
  stillWorking: { title: 'Working', description: 'still-working words', variant: 'default' },
};

const DEADLINE_MS = 60_000;
const SLOW_AFTER_MS = 12_000;
const functionsInstance = {} as Functions;

function callableError(code: string, message = 'server words', details?: unknown): Error {
  return Object.assign(new Error(message), { code, details });
}

function appCheckError(code: string): Error {
  return Object.assign(new Error(`AppCheck: ${code}`), { code });
}

function reasonOf(error: unknown): unknown {
  const details = (error as { details?: unknown } | null)?.details;
  return details !== null && typeof details === 'object'
    ? (details as { reason?: unknown }).reason
    : undefined;
}

const unauthenticated = (error: unknown) =>
  ['unauthenticated', 'functions/unauthenticated'].includes(
    String((error as { code?: unknown } | null)?.code),
  );

const refusals = {
  isPlatformTokenRefusal: (error: unknown) =>
    unauthenticated(error) && reasonOf(error) !== 'sign-in-required',
  isMaintenanceRefusal: (error: unknown) =>
    (error as { code?: unknown } | null)?.code === 'functions/unavailable' &&
    reasonOf(error) === 'maintenance',
};

const connectionDropped = appCheckError('appCheck/fetch-network-error');
const throttled = appCheckError('appCheck/throttled');
const tokenFetchRefused = appCheckError('appCheck/fetch-status-error');
const platformTokenRefusal = callableError('functions/unauthenticated', 'Unauthenticated');
const signInRequired = callableError('functions/unauthenticated', 'Sign in first.', {
  reason: 'sign-in-required',
});
const deadline = callableError('functions/deadline-exceeded', 'deadline-exceeded');
const maintenance = callableError('functions/unavailable', 'Back at noon.', {
  reason: 'maintenance',
});
const outage = callableError('functions/unavailable', 'The service is unavailable. [503]');
const notFound = callableError('functions/not-found', 'That one is gone. [404]');
const needsReview = callableError('functions/failed-precondition', 'Review it first.', {
  reason: 'needs-review',
});

function makeKit(overrides: Partial<CallablePolicyDefinition<Toast>> = {}) {
  const dismiss = vi.fn();
  const plumbing = {
    getFunctions: () => functionsInstance,
    showToast: vi.fn<CallablePolicyPlumbing<Toast>['showToast']>(() => ({ dismiss })),
    captureException: vi.fn<CallablePolicyPlumbing<Toast>['captureException']>(),
    captureMessage: vi.fn<CallablePolicyPlumbing<Toast>['captureMessage']>(),
    limitedUseAppCheck: vi.fn(() => true),
  } satisfies CallablePolicyPlumbing<Toast>;
  const respond = vi.fn<CallableBusinessAnswer['respond']>();
  const reviewAnswer: CallableBusinessAnswer = {
    recognise: (error) => callableRefusalReason(error, ['needs-review']) !== null,
    respond,
  };
  const kit = createCallablePolicy<Toast>({
    deadlineMs: DEADLINE_MS,
    slowCallAfterMs: SLOW_AFTER_MS,
    wording: WORDING,
    businessAnswers: [reviewAnswer],
    refusals,
    plumbing,
    ...overrides,
  });
  return { kit, plumbing, respond, dismiss };
}

function routing(overrides: Partial<CallableErrorRouting> = {}): CallableErrorRouting {
  return { showErrorToast: true, answeredRefusals: [], ...overrides };
}

describe('createCallablePolicy — the definition', () => {
  it('requires every wording slot', () => {
    const { stillWorking: _omitted, ...withoutStillWorking } = WORDING;
    // @ts-expect-error: a definition whose wording leaves a slot out does not type-check.
    const wording: CallableWording<Toast> = withoutStillWorking;
    expect(Object.keys(wording)).not.toContain('stillWorking');
  });

  it("rides the app's deadline and slow-call mark", () => {
    const { kit } = makeKit();
    expect(kit.policy.timeoutMs).toBe(DEADLINE_MS);
    expect(kit.policy.onSlowCall.afterMs).toBe(SLOW_AFTER_MS);
    expect(kit.policy.getFunctions()).toBe(functionsInstance);
  });

  it('shows the still-working wording for a slow call and hands back its dismiss', () => {
    const { kit, plumbing, dismiss } = makeKit();
    const close = kit.policy.onSlowCall.show({ functionName: 'slow' });
    expect(plumbing.showToast).toHaveBeenCalledWith(WORDING.stillWorking);
    close();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('asks for a limited-use token only when declared and this build requests it, read per call', () => {
    const { kit, plumbing } = makeKit();
    expect(kit.policy.resolveLimitedUseAppCheck(true)).toBe(true);
    expect(kit.policy.resolveLimitedUseAppCheck(false)).toBe(false);
    plumbing.limitedUseAppCheck.mockReturnValue(false);
    expect(kit.policy.resolveLimitedUseAppCheck(true)).toBe(false);
  });
});

describe('createCallablePolicy — routing a failed call, first match wins', () => {
  it('1. does nothing for an answer the caller surfaces itself, a business answer included', () => {
    const { kit, plumbing, respond } = makeKit();
    kit.policy.onActionError(needsReview, routing({ isAnswerSurfacedByCaller: () => true }));
    kit.policy.onActionError(outage, routing({ isAnswerSurfacedByCaller: () => true }));
    expect(respond).not.toHaveBeenCalled();
    expect(plumbing.showToast).not.toHaveBeenCalled();
  });

  it("2. runs a business answer's own action instead of a toast", () => {
    const { kit, plumbing, respond } = makeKit();
    kit.policy.onActionError(needsReview, routing());
    expect(respond).toHaveBeenCalledWith(needsReview);
    expect(plumbing.showToast).not.toHaveBeenCalled();
  });

  it('2. runs a business answer even when the call is declared with no toast', () => {
    const { kit, plumbing, respond } = makeKit();
    kit.policy.onActionError(needsReview, routing({ showErrorToast: false }));
    expect(respond).toHaveBeenCalledTimes(1);
    expect(plumbing.showToast).not.toHaveBeenCalled();
  });

  it('2. runs a business answer even when the caller declared its refusal code answered', () => {
    const { kit, respond } = makeKit();
    kit.policy.onActionError(needsReview, routing({ answeredRefusals: ['failed-precondition'] }));
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('3. shows nothing for any other failure when the call is declared with no toast', () => {
    const { kit, plumbing } = makeKit();
    for (const error of [
      connectionDropped,
      throttled,
      platformTokenRefusal,
      deadline,
      maintenance,
      outage,
    ]) {
      kit.policy.onActionError(error, routing({ showErrorToast: false }));
    }
    expect(plumbing.showToast).not.toHaveBeenCalled();
  });

  it('4. shows nothing for a refusal the caller declared answered, and toasts one it did not', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(notFound, routing({ answeredRefusals: ['not-found'] }));
    kit.policy.onActionError(
      platformTokenRefusal,
      routing({ answeredRefusals: ['unauthenticated'] }),
    );
    expect(plumbing.showToast).not.toHaveBeenCalled();

    kit.policy.onActionError(notFound, routing({ answeredRefusals: ['already-exists'] }));
    expect(plumbing.showToast).toHaveBeenCalledWith({
      ...WORDING.genericError,
      description: 'That one is gone.',
    });
  });

  it('5. says the connection dropped when the token fetch could not reach the network', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(connectionDropped, routing());
    expect(plumbing.showToast).toHaveBeenCalledWith(WORDING.connectionDropped);
  });

  it('6. says the request was not sent when App Check throttled it or its token failed', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(throttled, routing());
    kit.policy.onActionError(tokenFetchRefused, routing());
    expect(plumbing.showToast).toHaveBeenNthCalledWith(1, WORDING.notSent);
    expect(plumbing.showToast).toHaveBeenNthCalledWith(2, WORDING.notSent);
  });

  it('7. says the platform refused the tokens, and leaves the sign-in refusal in its own words', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(platformTokenRefusal, routing());
    kit.policy.onActionError(signInRequired, routing());
    expect(plumbing.showToast).toHaveBeenNthCalledWith(1, WORDING.tokenRefused);
    expect(plumbing.showToast).toHaveBeenNthCalledWith(2, {
      ...WORDING.genericError,
      description: 'Sign in first.',
    });
  });

  it('8. says the outcome is unknown when the deadline passed', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(deadline, routing());
    expect(plumbing.showToast).toHaveBeenCalledWith(WORDING.outcomeUnknown);
  });

  it("9. answers maintenance with the operator's message, or the slot's words without one", () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(maintenance, routing());
    kit.policy.onActionError(
      callableError('functions/unavailable', '', { reason: 'maintenance' }),
      routing(),
    );
    expect(plumbing.showToast).toHaveBeenNthCalledWith(1, {
      ...WORDING.maintenance,
      description: 'Back at noon.',
    });
    expect(plumbing.showToast).toHaveBeenNthCalledWith(2, WORDING.maintenance);
  });

  it("10. toasts anything else with the generic wording in the server's words, or the slot's", () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(outage, routing());
    kit.policy.onActionError({ code: 'functions/internal' }, routing());
    expect(plumbing.showToast).toHaveBeenNthCalledWith(1, {
      ...WORDING.genericError,
      description: 'The service is unavailable.',
    });
    expect(plumbing.showToast).toHaveBeenNthCalledWith(2, WORDING.genericError);
  });

  it('10. toasts a client-side error with the generic wording, never its message', () => {
    const { kit, plumbing } = makeKit();
    kit.policy.onActionError(new Error('boom'), routing());
    kit.policy.onActionError(
      new TypeError("Cannot read properties of undefined (reading 'x')"),
      routing(),
    );
    expect(plumbing.showToast).toHaveBeenNthCalledWith(1, WORDING.genericError);
    expect(plumbing.showToast).toHaveBeenNthCalledWith(2, WORDING.genericError);
  });

  it("10. still shows a rejection's own message in the generic toast", () => {
    const { kit, plumbing } = makeKit({ businessAnswers: [] });
    kit.policy.onActionError(needsReview, routing());
    expect(plumbing.showToast).toHaveBeenCalledWith({
      ...WORDING.genericError,
      description: 'Review it first.',
    });
  });

  it('marks a failure it routed as a callable rejection, whatever its code', () => {
    const { kit } = makeKit();
    const odd = new Error('a failure with no callable code');
    expect(kit.isCallableRejection(odd)).toBe(false);
    kit.policy.onActionError(odd, routing({ showErrorToast: false }));
    expect(kit.isCallableRejection(odd)).toBe(true);
  });
});

describe('createCallablePolicy — callableFailureKind, the kind the policy decides', () => {
  it.each([
    ['the token fetch lost its connection', connectionDropped, 'connection-dropped'],
    ['App Check throttled the call', throttled, 'not-sent'],
    ['the App Check token failed', tokenFetchRefused, 'not-sent'],
    ['the platform refused the tokens', platformTokenRefusal, 'token-refused'],
    ['the deadline passed', deadline, 'outcome-unknown'],
    ['maintenance', maintenance, 'maintenance'],
    ['the server asked for sign-in', signInRequired, 'other'],
    ['an outage', outage, 'other'],
    ['a designed refusal', notFound, 'other'],
    ['a client-side error', new TypeError('x is undefined'), 'other'],
  ] as const)('names the kind when %s', (_case, error, kind) => {
    const { kit } = makeKit();
    expect(kit.callableFailureKind(error)).toBe(kind);
  });
});

describe('createCallablePolicy — callableFailureToast for a caller that shows its own failures', () => {
  it.each([
    ['the token fetch lost its connection', connectionDropped, WORDING.connectionDropped],
    ['App Check throttled the call', throttled, WORDING.notSent],
    ['the App Check token failed', tokenFetchRefused, WORDING.notSent],
    ['the platform refused the tokens', platformTokenRefusal, WORDING.tokenRefused],
    ['the deadline passed', deadline, WORDING.outcomeUnknown],
    ['maintenance', maintenance, { ...WORDING.maintenance, description: 'Back at noon.' }],
    [
      'maintenance with no message of its own',
      callableError('functions/unavailable', '', { reason: 'maintenance' }),
      WORDING.maintenance,
    ],
    ['an outage', outage, { ...WORDING.genericError, description: 'The service is unavailable.' }],
    [
      'the server asked for sign-in',
      signInRequired,
      { ...WORDING.genericError, description: 'Sign in first.' },
    ],
    ['a client-side error', new TypeError('x is undefined'), WORDING.genericError],
  ] as const)(
    'is the one toast the routing shows when %s, and shows nothing itself',
    (_case, error, expected) => {
      const { kit, plumbing } = makeKit();
      expect(kit.callableFailureToast(error)).toEqual(expected);
      expect(plumbing.showToast).not.toHaveBeenCalled();

      kit.policy.onActionError(error, routing());
      expect(plumbing.showToast).toHaveBeenCalledTimes(1);
      expect(plumbing.showToast).toHaveBeenCalledWith(expected);
    },
  );
});

describe('createCallablePolicy — captureCallableFault', () => {
  it('reports nothing for an expected answer: a designed refusal, maintenance, a business answer', () => {
    const { kit, plumbing } = makeKit();
    kit.captureCallableFault(notFound);
    kit.captureCallableFault(callableError('permission-denied'));
    kit.captureCallableFault(signInRequired);
    kit.captureCallableFault(maintenance);
    kit.captureCallableFault(needsReview);
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).not.toHaveBeenCalled();
  });

  it("reports nothing when the token fetch's connection failed", () => {
    const { kit, plumbing } = makeKit();
    kit.captureCallableFault(connectionDropped, { functionName: 'fn' });
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).not.toHaveBeenCalled();
  });

  it('reports a throttle or a failed token as a warning carrying its App Check code', () => {
    const { kit, plumbing } = makeKit();
    kit.captureCallableFault(throttled, { functionName: 'fn' });
    kit.captureCallableFault(tokenFetchRefused);
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).toHaveBeenNthCalledWith(
      1,
      CALLABLE_FAULT_REPORTS.neverSent,
      'warning',
      { functionName: 'fn', appCheckCode: 'appCheck/throttled' },
    );
    expect(plumbing.captureMessage).toHaveBeenNthCalledWith(
      2,
      CALLABLE_FAULT_REPORTS.neverSent,
      'warning',
      { appCheckCode: 'appCheck/fetch-status-error' },
    );
  });

  it('reports a platform token refusal as a warning, never dropped as an answer', () => {
    const { kit, plumbing } = makeKit();
    kit.captureCallableFault(platformTokenRefusal, { functionName: 'fn' });
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).toHaveBeenCalledWith(
      CALLABLE_FAULT_REPORTS.tokenRefused,
      'warning',
      { functionName: 'fn' },
    );
  });

  it('reports a recovered limited-use fallback as a warning', () => {
    const { kit, plumbing } = makeKit();
    const context = { functionName: 'fn', limitedUseAppCheckFallback: true };
    kit.captureCallableFault(throttled, context);
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).toHaveBeenCalledTimes(1);
    expect(plumbing.captureMessage).toHaveBeenCalledWith(
      CALLABLE_FAULT_REPORTS.recoveredFallback,
      'warning',
      context,
    );
  });

  it('reports anything else as an exception, once: an outage, a deadline, an error with no code', () => {
    const { kit, plumbing } = makeKit();
    const noCode = new Error('no code at all');
    kit.captureCallableFault(outage, { functionName: 'fn' });
    kit.captureCallableFault(deadline);
    kit.captureCallableFault(noCode);
    expect(plumbing.captureMessage).not.toHaveBeenCalled();
    expect(plumbing.captureException).toHaveBeenCalledTimes(3);
    expect(plumbing.captureException).toHaveBeenNthCalledWith(1, outage, { functionName: 'fn' });
    expect(plumbing.captureException).toHaveBeenNthCalledWith(2, deadline, {});
    expect(plumbing.captureException).toHaveBeenNthCalledWith(3, noCode, {});
  });

  it("the policy's recovered-fallback capture keeps the fallback report and drops every failure", () => {
    const { kit, plumbing } = makeKit();
    kit.policy.captureRecoveredFallback(outage, { functionName: 'fn' });
    kit.policy.captureRecoveredFallback(throttled, { limitedUseAppCheckFallback: true });
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).toHaveBeenCalledTimes(1);
  });
});

describe('createCallablePolicy — describeCallableError for a caller-owned surface', () => {
  it("words each transport and platform failure from the app's slots", () => {
    const { kit } = makeKit();
    expect(kit.describeCallableError(connectionDropped, 'fallback')).toBe(
      WORDING.connectionDropped.description,
    );
    expect(kit.describeCallableError(throttled, 'fallback')).toBe(WORDING.notSent.description);
    expect(kit.describeCallableError(tokenFetchRefused, 'fallback')).toBe(
      WORDING.notSent.description,
    );
    expect(kit.describeCallableError(platformTokenRefusal, 'fallback')).toBe(
      WORDING.tokenRefused.description,
    );
    expect(kit.describeCallableError(deadline, 'fallback')).toBe(
      WORDING.outcomeUnknown.description,
    );
    expect(kit.describeCallableError(maintenance, 'fallback')).toBe('Back at noon.');
  });

  it("keeps the server's own answer without the SDK's status suffix", () => {
    const { kit } = makeKit();
    expect(kit.describeCallableError(notFound)).toBe('That one is gone.');
    expect(kit.describeCallableError(signInRequired)).toBe('Sign in first.');
  });

  it("falls back to the caller's words, then to the generic slot's", () => {
    const { kit } = makeKit();
    const silent = callableError('functions/internal', '');
    expect(kit.describeCallableError(silent, 'Nothing changed.')).toBe('Nothing changed.');
    expect(kit.describeCallableError(silent)).toBe(WORDING.genericError.description);
  });

  it("returns the caller's words for a failure that is not a callable rejection", () => {
    const { kit } = makeKit();
    expect(kit.describeCallableError(new Error('boom'), 'fallback text')).toBe('fallback text');
    expect(kit.describeCallableError(new TypeError('x is undefined'), 'fallback text')).toBe(
      'fallback text',
    );
  });

  it("shows a designed refusal's own message", () => {
    const { kit } = makeKit({ businessAnswers: [] });
    expect(kit.describeCallableError(needsReview, 'fallback text')).toBe('Review it first.');
  });
});

describe('createCallablePolicy — the predicates', () => {
  it('counts every designed refusal, maintenance, and a business answer as an expected answer', () => {
    const { kit } = makeKit();
    expect(kit.isExpectedCallableAnswer(notFound)).toBe(true);
    expect(kit.isExpectedCallableAnswer(callableError('not-found'))).toBe(true);
    expect(kit.isExpectedCallableAnswer(signInRequired)).toBe(true);
    expect(kit.isExpectedCallableAnswer(maintenance)).toBe(true);
    expect(kit.isExpectedCallableAnswer(needsReview)).toBe(true);
  });

  it('never counts a platform token refusal, a deadline, a never-sent call, or an outage', () => {
    const { kit } = makeKit();
    for (const error of [platformTokenRefusal, deadline, throttled, connectionDropped, outage]) {
      expect(kit.isExpectedCallableAnswer(error)).toBe(false);
    }
  });

  it("says a business answer is surfaced elsewhere, and nothing that is not one of the app's", () => {
    const { kit } = makeKit();
    expect(kit.isAnswerSurfacedElsewhere(needsReview)).toBe(true);
    expect(kit.isAnswerSurfacedElsewhere(notFound)).toBe(false);
    expect(makeKit({ businessAnswers: [] }).kit.isAnswerSurfacedElsewhere(needsReview)).toBe(false);
  });

  it("reads a designed refusal's own message, and nothing for a fault", () => {
    const { kit } = makeKit();
    expect(kit.callableRefusalMessage(notFound)).toBe('That one is gone.');
    expect(kit.callableRefusalMessage(outage)).toBeNull();
  });

  it("never hands a surface the message of a failure that is not the server's rejection", () => {
    const { kit } = makeKit();
    expect(kit.callableRejectionMessage(new Error('plain [404]'))).toBe('');
    expect(kit.callableRejectionMessage(new TypeError('x is undefined'))).toBe('');
    expect(
      kit.callableRefusalMessage(Object.assign(new Error('internal'), { code: 'not-found' })),
    ).toBeNull();
    expect(kit.callableRejectionMessage(needsReview)).toBe('Review it first.');
  });

  it('keeps a routed client error a callable rejection without making its message copy', () => {
    const { kit } = makeKit();
    const clientBug = new TypeError('x is undefined');
    kit.policy.onActionError(clientBug, routing({ showErrorToast: false }));
    expect(kit.isCallableRejection(clientBug)).toBe(true);
    expect(kit.callableRejectionMessage(clientBug)).toBe('');
    expect(kit.describeCallableError(clientBug)).toBe(WORDING.genericError.description);
  });
});

describe('createCallablePolicy — through a declared callable', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  function failingCallable(...errors: Error[]) {
    const invoke = vi.fn();
    for (const error of errors) {
      invoke.mockImplementationOnce(() => Promise.reject(error));
    }
    invoke.mockImplementation(() => Promise.resolve({ data: { ok: true } }));
    vi.mocked(httpsCallable).mockReturnValue(Object.assign(invoke, { stream: vi.fn() }));
  }

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  }

  it('a business answer to an action declared with no toast still acts, and is not captured', async () => {
    failingCallable(needsReview);
    const { kit, plumbing, respond } = makeKit();
    const useAction = createCallables(kit.policy).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction({ showErrorToast: false }), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(needsReview);
    });

    expect(respond).toHaveBeenCalledWith(needsReview);
    expect(plumbing.showToast).not.toHaveBeenCalled();
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).not.toHaveBeenCalled();
  });

  it('a call whose token fetch lost its connection says so and reports nothing', async () => {
    failingCallable(connectionDropped);
    const { kit, plumbing } = makeKit();
    const useAction = createCallables(kit.policy).createCallableHook<void, unknown>('doThing', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useAction(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(connectionDropped);
    });

    expect(plumbing.showToast).toHaveBeenCalledWith(WORDING.connectionDropped);
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).not.toHaveBeenCalled();
  });

  it('a throttled limited-use call that recovers on the standard token still reports its warning', async () => {
    failingCallable(throttled);
    const { kit, plumbing } = makeKit();
    const useAction = createCallables(kit.policy).createCallableHook<void, unknown>('doThing', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useAction(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).resolves.toEqual({ ok: true });
    });

    expect(plumbing.showToast).not.toHaveBeenCalled();
    expect(plumbing.captureException).not.toHaveBeenCalled();
    expect(plumbing.captureMessage).toHaveBeenCalledWith(
      CALLABLE_FAULT_REPORTS.recoveredFallback,
      'warning',
      { functionName: 'doThing', timeoutMs: DEADLINE_MS, limitedUseAppCheckFallback: true },
    );
  });

  it('a genuine fault toasts once with the generic wording and is captured once as an exception', async () => {
    failingCallable(outage);
    const { kit, plumbing } = makeKit();
    const useAction = createCallables(kit.policy).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(outage);
    });

    expect(plumbing.showToast).toHaveBeenCalledTimes(1);
    expect(plumbing.showToast).toHaveBeenCalledWith({
      ...WORDING.genericError,
      description: 'The service is unavailable.',
    });
    expect(plumbing.captureException).toHaveBeenCalledTimes(1);
    expect(plumbing.captureException).toHaveBeenCalledWith(outage, {
      functionName: 'doThing',
      timeoutMs: DEADLINE_MS,
    });
  });
});
