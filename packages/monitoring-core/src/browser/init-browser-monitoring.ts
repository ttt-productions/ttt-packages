import {
  captureConsoleIntegration,
  httpClientIntegration,
  init,
  makeBrowserOfflineTransport,
  makeFetchTransport,
  replayIntegration,
  type BrowserOptions,
} from '@sentry/nextjs';
import { createTelemetryScrubber, redactEvent, type ForbiddenPattern } from '../scrubber.js';

type SentryOptions = BrowserOptions;
type BeforeSend = NonNullable<SentryOptions['beforeSend']>;
type BeforeSendTransaction = NonNullable<SentryOptions['beforeSendTransaction']>;
type SentryIntegration = Extract<NonNullable<SentryOptions['integrations']>, unknown[]>[number];

export type BrowserErrorEvent = Parameters<BeforeSend>[0];
export type BrowserEventHint = Parameters<BeforeSend>[1];

export type BrowserSessionReplayOptions = {
  onErrorSampleRate: number;
  sessionSampleRate: number;
};

export type BrowserNetworkCaptureOptions = {
  ignoreUrls?: readonly RegExp[];
};

export type BrowserMonitoringOptions = {
  enabled: boolean;
  dsn: string | undefined;
  environment: string;
  scrubPatterns?: ForbiddenPattern[];
  dropEvent?: (event: BrowserErrorEvent, hint: BrowserEventHint) => boolean;
  ignoreErrors?: readonly (string | RegExp)[];
  ignoreInAppBrowserNoise?: boolean;
  attachIndexedDbNames?: (error: unknown) => boolean;
  sessionReplay: false | BrowserSessionReplayOptions;
  tracesSampleRate: false | number;
  networkCapture: false | BrowserNetworkCaptureOptions;
};

export const DEFAULT_BROWSER_IGNORE_ERRORS: readonly (string | RegExp)[] = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Network request failed',
  'Failed to fetch',
  'NetworkError',
  'Load failed',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  // The Firebase callable SDK's generic strings for an answer that never reached the function: a
  // cold start's HTML error page, or a request cut off mid-flight (status 0). A server's own fault
  // carries its own message and status.
  'Response is not valid JSON object.',
  /^(FirebaseError: )?internal( \[0\])?$/i,
  // Firestore's console line while its channel reconnects on its own.
  /Could not reach Cloud Firestore backend/,
];

// Scripts in-app browsers inject into every page they show: Snapchat's bridge and Facebook's
// Android logger.
export const IN_APP_BROWSER_IGNORE_ERRORS: readonly RegExp[] = [
  /SCDynimacBridge/,
  /Java object is gone/,
];

function isIgnoredNetworkEvent(event: BrowserErrorEvent, ignoreUrls: readonly RegExp[]): boolean {
  const mechanism = event.exception?.values?.[0]?.mechanism?.type;
  const url = event.request?.url;
  return (
    typeof mechanism === 'string' &&
    mechanism.startsWith('auto.http.client') &&
    typeof url === 'string' &&
    ignoreUrls.some((pattern) => pattern.test(url))
  );
}

async function withIndexedDbNames(event: BrowserErrorEvent): Promise<BrowserErrorEvent> {
  try {
    const listing = await globalThis.indexedDB?.databases?.();
    if (!listing) return event;
    const indexedDbNames = listing.flatMap((database) => (database.name ? [database.name] : []));
    return { ...event, extra: { ...event.extra, indexedDbNames } };
  } catch {
    return event;
  }
}

export function initBrowserMonitoring(options: BrowserMonitoringOptions): void {
  if (!options.enabled) return;

  const patterns = options.scrubPatterns ?? [];
  const scrub = createTelemetryScrubber({ patterns });
  const ignoreUrls = options.networkCapture ? (options.networkCapture.ignoreUrls ?? []) : [];

  const beforeSend: BeforeSend = (event, hint) => {
    if (options.dropEvent?.(event, hint)) return null;
    if (isIgnoredNetworkEvent(event, ignoreUrls)) return null;
    const scrubbed = scrub(event);
    if (!options.attachIndexedDbNames?.(hint.originalException)) return scrubbed;
    return withIndexedDbNames(scrubbed);
  };

  const integrations: SentryIntegration[] = [captureConsoleIntegration({ levels: ['error'] })];
  if (options.sessionReplay) {
    integrations.push(
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        // A recording frame passes through no hook or event processor, so its strings are
        // redacted here.
        beforeAddRecordingEvent: (frame) => {
          redactEvent({ extra: frame }, { patterns });
          return frame;
        },
      }),
      // A replay event passes through neither `beforeSend` nor `beforeSendTransaction`.
      {
        name: 'TelemetryScrubberReplayEvents',
        processEvent: (event) => (event.type === 'replay_event' ? scrub(event) : event),
      },
    );
  }
  if (options.networkCapture) integrations.push(httpClientIntegration());

  const sentryOptions: SentryOptions = {
    dsn: options.dsn,
    environment: options.environment,
    debug: false,
    transport: makeBrowserOfflineTransport(makeFetchTransport),
    beforeSend,
    integrations,
    ignoreErrors: [
      ...DEFAULT_BROWSER_IGNORE_ERRORS,
      ...(options.ignoreInAppBrowserNoise ? IN_APP_BROWSER_IGNORE_ERRORS : []),
      ...(options.ignoreErrors ?? []),
    ],
  };
  if (options.tracesSampleRate !== false) {
    const beforeSendTransaction: BeforeSendTransaction = (event) => scrub(event);
    sentryOptions.tracesSampleRate = options.tracesSampleRate;
    sentryOptions.beforeSendTransaction = beforeSendTransaction;
  }
  if (options.sessionReplay) {
    sentryOptions.replaysOnErrorSampleRate = options.sessionReplay.onErrorSampleRate;
    sentryOptions.replaysSessionSampleRate = options.sessionReplay.sessionSampleRate;
  }
  init(sentryOptions);
}
