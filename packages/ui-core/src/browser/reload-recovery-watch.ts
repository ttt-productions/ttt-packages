import { reloadRecoveryKindOf, type ReloadRecoveryKind } from '../lib/reload-recovery.js';

export type ReloadRecoveryTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface ReloadRecoveryWatch {
  current: () => ReloadRecoveryKind | null;
  subscribe: (listener: () => void) => () => void;
  stop: () => void;
}

export function createReloadRecoveryWatch(
  target: ReloadRecoveryTarget = window,
): ReloadRecoveryWatch {
  let recorded: ReloadRecoveryKind | null = null;
  const listeners = new Set<() => void>();

  const record = (kind: ReloadRecoveryKind | null) => {
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
