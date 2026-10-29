import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BrowserOptions, Event } from '@sentry/nextjs';

const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: BrowserOptions) => undefined>(),
  consoleOptions: [] as unknown[],
  replayOptions: [] as unknown[],
}));

vi.mock(import('@sentry/nextjs'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  type Sdk = Awaited<ReturnType<typeof importOriginal>>;
  // Vitest resolves the SDK's server build, which has no browser integrations, so each stub hands
  // back a named marker in the SDK's return type.
  const marker = <K extends keyof Sdk>(name: string) =>
    ({ name }) as Sdk[K] extends (...args: never[]) => infer R ? R : never;
  return stubModule(importOriginal, {
    init: sentry.init,
    captureConsoleIntegration: (options) => {
      sentry.consoleOptions.push(options);
      return marker<'captureConsoleIntegration'>('CaptureConsole');
    },
    httpClientIntegration: () => marker<'httpClientIntegration'>('HttpClient'),
    replayIntegration: (options) => {
      sentry.replayOptions.push(options);
      return marker<'replayIntegration'>('Replay');
    },
    makeFetchTransport: () => marker<'makeFetchTransport'>('fetch'),
    makeBrowserOfflineTransport: () => () => marker<'makeFetchTransport'>('offline'),
  });
});

import {
  DEFAULT_BROWSER_IGNORE_ERRORS,
  IN_APP_BROWSER_IGNORE_ERRORS,
  initBrowserMonitoring,
  type BrowserErrorEvent,
  type BrowserEventHint,
  type BrowserMonitoringOptions,
} from '../src/browser/init-browser-monitoring.js';
import { REDACTION_PLACEHOLDER } from '../src/scrubber.js';

const ERRORS_ONLY: BrowserMonitoringOptions = {
  enabled: true,
  dsn: 'https://key@example.ingest/1',
  environment: 'test',
  sessionReplay: false,
  tracesSampleRate: false,
  networkCapture: false,
};

const FULL: BrowserMonitoringOptions = {
  ...ERRORS_ONLY,
  sessionReplay: { onErrorSampleRate: 1, sessionSampleRate: 0 },
  tracesSampleRate: 0.1,
  networkCapture: { ignoreUrls: [/^https:\/\/fn\.example\//] },
};

function initWith(options: BrowserMonitoringOptions): BrowserOptions {
  initBrowserMonitoring(options);
  expect(sentry.init).toHaveBeenCalledTimes(1);
  return sentry.init.mock.calls[0]![0];
}

function integrationNames(options: BrowserOptions): string[] {
  const list = options.integrations;
  if (!Array.isArray(list)) throw new Error('integrations is not a list');
  return list.map((integration) => integration.name);
}

function errorEvent(message: string): BrowserErrorEvent {
  return { type: undefined, message };
}

const NO_HINT: BrowserEventHint = {};

async function send(
  options: BrowserOptions,
  event: BrowserErrorEvent,
  hint: BrowserEventHint = NO_HINT,
): Promise<BrowserErrorEvent | null> {
  return options.beforeSend!(event, hint);
}

describe('initBrowserMonitoring', () => {
  beforeEach(() => {
    sentry.init.mockClear();
    sentry.consoleOptions.length = 0;
    sentry.replayOptions.length = 0;
  });

  it('starts no SDK when monitoring is off', () => {
    initBrowserMonitoring({ ...FULL, enabled: false });
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('an errors-only config records no replay, samples no trace and captures no failed fetch', () => {
    const options = initWith(ERRORS_ONLY);
    expect(integrationNames(options)).toEqual(['CaptureConsole']);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.beforeSendTransaction).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
    expect(options.replaysSessionSampleRate).toBeUndefined();
  });

  it('captures console errors only, never warnings or logs', () => {
    initWith(ERRORS_ONLY);
    expect(sentry.consoleOptions).toEqual([{ levels: ['error'] }]);
  });

  it('sends through the offline transport with the given dsn and environment', () => {
    const options = initWith(ERRORS_ONLY);
    expect(options.dsn).toBe(ERRORS_ONLY.dsn);
    expect(options.environment).toBe('test');
    expect(options.transport).toBeTypeOf('function');
  });

  it('turns each switch on independently', () => {
    const options = initWith(FULL);
    expect(integrationNames(options)).toEqual([
      'CaptureConsole',
      'Replay',
      'TelemetryScrubberReplayEvents',
      'HttpClient',
    ]);
    expect(options.tracesSampleRate).toBe(0.1);
    expect(options.replaysOnErrorSampleRate).toBe(1);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(sentry.replayOptions[0]).toMatchObject({ maskAllText: true, blockAllMedia: true });
  });

  it('scrubs error events with the app patterns on top of the defaults', async () => {
    const options = initWith({ ...ERRORS_ONLY, scrubPatterns: [/case-\d+/g] });
    const sent = await send(options, errorEvent('case-42 from 10.1.2.3'));
    expect(sent?.message).toBe(`${REDACTION_PLACEHOLDER} from ${REDACTION_PLACEHOLDER}`);
  });

  it('drops an event the app says to drop', async () => {
    const options = initWith({
      ...ERRORS_ONLY,
      dropEvent: (_event, hint) => hint.originalException === 'designed answer',
    });
    expect(await send(options, errorEvent('x'), { originalException: 'designed answer' })).toBe(
      null,
    );
    expect(await send(options, errorEvent('y'), { originalException: 'fault' })).not.toBe(null);
  });

  it('drops a failed-fetch capture of an ignored URL and keeps every other one', async () => {
    const options = initWith(FULL);
    const fetchFailure = (url: string): BrowserErrorEvent => ({
      type: undefined,
      exception: { values: [{ mechanism: { type: 'auto.http.client.fetch', handled: false } }] },
      request: { url },
    });
    expect(await send(options, fetchFailure('https://fn.example/call'))).toBe(null);
    expect(await send(options, fetchFailure('https://api.example/other'))).not.toBe(null);
  });

  it('keeps an error event that merely names an ignored URL', async () => {
    const options = initWith(FULL);
    const event: BrowserErrorEvent = {
      type: undefined,
      exception: { values: [{ mechanism: { type: 'generic', handled: true } }] },
      request: { url: 'https://fn.example/call' },
    };
    expect(await send(options, event)).not.toBe(null);
  });

  it('attaches the page IndexedDB names to an event the app marks', async () => {
    vi.stubGlobal('indexedDB', {
      databases: () => Promise.resolve([{ name: 'firestore/app' }, { name: 'sentry-offline' }]),
    });
    const options = initWith({
      ...ERRORS_ONLY,
      attachIndexedDbNames: (error) => error === 'disconnect',
    });
    const marked = await send(options, errorEvent('lost'), { originalException: 'disconnect' });
    expect(marked?.extra).toEqual({ indexedDbNames: ['firestore/app', 'sentry-offline'] });
    const unmarked = await send(options, errorEvent('other'), { originalException: 'other' });
    expect(unmarked?.extra).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('still sends a marked event when the IndexedDB listing fails', async () => {
    vi.stubGlobal('indexedDB', { databases: () => Promise.reject(new Error('blocked')) });
    const options = initWith({ ...ERRORS_ONLY, attachIndexedDbNames: () => true });
    const sent = await send(options, errorEvent('lost'));
    expect(sent?.message).toBe('lost');
    expect(sent?.extra).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('ignores the default noise, the app list, and in-app-browser noise only when asked', () => {
    const off = initWith({ ...ERRORS_ONLY, ignoreErrors: ['App noise'] });
    expect(off.ignoreErrors).toEqual([...DEFAULT_BROWSER_IGNORE_ERRORS, 'App noise']);
    sentry.init.mockClear();
    const on = initWith({ ...ERRORS_ONLY, ignoreInAppBrowserNoise: true });
    expect(on.ignoreErrors).toEqual([
      ...DEFAULT_BROWSER_IGNORE_ERRORS,
      ...IN_APP_BROWSER_IGNORE_ERRORS,
    ]);
  });

  it('scrubs sampled transactions', () => {
    const options = initWith(FULL);
    const sent = options.beforeSendTransaction!(
      { type: 'transaction', transaction: '/reset?oobCode=abcdef123' },
      NO_HINT,
    );
    expect(sent).toMatchObject({ transaction: `/reset?${REDACTION_PLACEHOLDER}` });
  });

  it('scrubs replay events and leaves every other event to its hook', () => {
    const options = initWith(FULL);
    const list = options.integrations as Array<{
      name: string;
      processEvent?: (event: Event) => Event;
    }>;
    const processor = list.find(
      (integration) => integration.name === 'TelemetryScrubberReplayEvents',
    );
    const replayEvent: Event & { urls: string[] } = {
      type: 'replay_event',
      urls: ['https://a.example/reset?oobCode=abcdef123'],
    };
    processor!.processEvent!(replayEvent);
    expect(replayEvent.urls).toEqual([`https://a.example/reset?${REDACTION_PLACEHOLDER}`]);
    const error = processor!.processEvent!(errorEvent('oobCode=abcdef123'));
    expect(error.message).toBe('oobCode=abcdef123');
  });

  it('redacts every string in a replay recording frame', () => {
    initWith({ ...FULL, scrubPatterns: [/case-\d+/g] });
    const replay = sentry.replayOptions[0] as {
      beforeAddRecordingEvent: (frame: unknown) => unknown;
    };
    const frame = { type: 5, data: { payload: { href: '/cases/case-7?oobCode=abcdef123' } } };
    expect(replay.beforeAddRecordingEvent(frame)).toEqual({
      type: 5,
      data: { payload: { href: `/cases/${REDACTION_PLACEHOLDER}?${REDACTION_PLACEHOLDER}` } },
    });
  });
});
