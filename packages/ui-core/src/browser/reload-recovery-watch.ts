// Watches the page for the first failure only a reload repairs. Started once at the app's client
// entry, before React mounts, so a failure raised during startup is recorded for the notice to show
// once it mounts. It only listens: it never calls `preventDefault`, so the app's monitoring still
// captures every event once, and it never reloads the page.

import { reloadRecoveryKindOf, type ReloadRecoveryKind } from '../lib/reload-recovery.js';

/** What the watch listens on: the page's window. */
export type ReloadRecoveryTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface ReloadRecoveryWatch {
  /** The first failure only a reload repairs since the watch started, or `null` while there is none. */
  current: () => ReloadRecoveryKind | null;
  /** Calls `listener` once, when the first failure is recorded. Answers the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Stops listening; a failure already recorded stays. */
  stop: () => void;
}

export function createReloadRecoveryWatch(
  target: ReloadRecoveryTarget = window,
): ReloadRecoveryWatch {
  let recorded: ReloadRecoveryKind | null = null;
  const listeners = new Set<() => void>();

  const record = (kind: ReloadRecoveryKind | null) => {
    // The first failure stands: a repeat of it, or the other one after it, changes nothing.
    if (kind === null || recorded !== null) return;
    recorded = kind;
    for (const listener of [...listeners]) listener();
  };
  // An error event's `error` is the thrown value; a cross-origin script's carries only the message.
  const onError = (event: ErrorEvent) =>
    record(reloadRecoveryKindOf(event.error) ?? reloadRecoveryKindOf({ message: event.message }));
  const onRejection = (event: PromiseRejectionEvent) => record(reloadRecoveryKindOf(event.reason));

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);

  return {
    current: () => recorded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop: () => {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
