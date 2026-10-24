'use client';

// SANCTIONED EXCEPTION to RULE-STD-ARCH-206 (packages read and write Firestore only
// through @ttt-productions/query-core).
//
// WHY this provider reads Firestore directly instead of via a query-core hook:
//   1. It needs snapshot *transition events* — onSnapshot's `docChanges()` with
//      added / modified / removed — to fire one-shot terminal callbacks and to
//      suppress the initial snapshot. query-core's hooks return "the current
//      list", not per-doc transitions, so they cannot express this state machine.
//   2. The subscription is already abstracted behind an injectable
//      `FirestoreSubscribeFn` (the `subscribe` prop); the direct firebase code
//      path lives ONLY in `defaultFirestoreSubscribe` below and is fully
//      swappable (tests / alternate backends inject their own).
//   3. The static ESM `firebase/firestore` import is load-bearing for Next.js +
//      Turbopack module identity (see defaultFirestoreSubscribe's comment).
//
// Do NOT "migrate" this onto query-core without preserving docChanges() semantics.
import { collection, onSnapshot, query, where, type Firestore } from 'firebase/firestore';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  isPendingMediaNonTerminalStatus,
  isPendingMediaTerminalStatus,
  PendingMediaStatusSchema,
  type PendingMediaNonTerminalStatus,
  type PendingMediaStatus,
} from '@ttt-productions/media-schemas';

const STATUS = PendingMediaStatusSchema.enum;

export type InFlightUploadStatus = PendingMediaStatus;

export type InFlightUploadBase<TFileOrigin extends string = string> = {
  id: string;
  fileOrigin: TFileOrigin;
  surface: string;
  createdAt: number;
  targetIds?: string[];
  originalContentType?: string;
  originalSize?: number;
};

export type InFlightUploadActive<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: PendingMediaNonTerminalStatus;
  };

export type InFlightUploadCompleted<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: typeof PendingMediaStatusSchema.enum.completed;
    completedAt: number;
    uploadTrayClearedAt?: number;
    uploadTrayClearedBy?: string;
    uploadTraySeenAt?: number;
    uploadTraySeenBy?: string;
  };

export type InFlightUploadFailed<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: typeof PendingMediaStatusSchema.enum.failed;
    failedAt: number;
    errorCategory: string;
    errorMessage: string;
    uploadTrayClearedAt?: number;
    uploadTrayClearedBy?: string;
    uploadTraySeenAt?: number;
    uploadTraySeenBy?: string;
  };

export type InFlightUploadRejected<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: typeof PendingMediaStatusSchema.enum.rejected;
    rejectedAt: number;
    rejectionType: 'text' | 'media';
    errorMessage: string;
    violationId?: string;
    uploadTrayClearedAt?: number;
    uploadTrayClearedBy?: string;
    uploadTraySeenAt?: number;
    uploadTraySeenBy?: string;
  };

export type InFlightUpload<TFileOrigin extends string = string> =
  | InFlightUploadActive<TFileOrigin>
  | InFlightUploadCompleted<TFileOrigin>
  | InFlightUploadFailed<TFileOrigin>
  | InFlightUploadRejected<TFileOrigin>;

export type ParsedPendingMedia<TFileOrigin extends string = string> = {
  id: string;
  userId: string;
  fileOrigin: TFileOrigin;
  status: InFlightUploadStatus;
  createdAt: number;
  surface: string;
  targetIds?: string[];
  originalContentType?: string;
  originalSize?: number;
  completedAt?: number;
  failedAt?: number;
  rejectedAt?: number;
  errorCategory?: string;
  errorMessage?: string;
  rejectionType?: 'text' | 'media';
  violationId?: string;
  uploadTrayClearedAt?: number;
  uploadTrayClearedBy?: string;
  uploadTraySeenAt?: number;
  uploadTraySeenBy?: string;
  domainEvents?: unknown;
};

export type InFlightUploadsAdapter<TFileOrigin extends string = string> = {
  getCurrentUserId: () => string | null;

  db: unknown;

  collectionPath: string;

  listenerWindowMs: number;

  parsePendingMedia: (raw: unknown) => ParsedPendingMedia<TFileOrigin>;

  onUploadCompleted: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  onUploadFailed: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  onUploadRejected: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  onMonitoringEvent: (event: InFlightUploadsMonitoringEvent<TFileOrigin>) => void;
};

export type InFlightUploadsMonitoringEvent<TFileOrigin extends string = string> =
  | {
      type: 'breadcrumb';
      category: 'upload.terminal';
      level: 'info';
      message: string;
      data: {
        id: string;
        fileOrigin: TFileOrigin;
        status: InFlightUploadStatus;
        surface: string;
      };
    }
  | {
      type: 'parse-error';
      docId: string;
      error: unknown;
      data: unknown;
    }
  | {
      type: 'listener-error';
      error: unknown;
    };

export type FirestoreSubscribeFn = (args: {
  db: unknown;
  collectionPath: string;
  userId: string;
  windowStartMs: number;
  onSnapshot: (snapshot: FirestoreLikeSnapshot) => void;
  onError: (error: unknown) => void;
}) => () => void;

export type FirestoreLikeSnapshot = {
  docChanges: () => FirestoreLikeDocChange[];
  metadata?: { fromCache: boolean };
};

/** Firestore serves cached snapshots offline without firing the error callback, so liveness comes from metadata. */
export type UploadsSourceState = 'connecting' | 'live' | 'offline' | 'error';

export type FirestoreLikeDocChange = {
  type: 'added' | 'modified' | 'removed';
  doc: {
    id: string;
    data: () => unknown;
  };
};

interface InFlightUploadsContextValue<TFileOrigin extends string = string> {
  uploads: Map<string, InFlightUpload<TFileOrigin>>;
  sourceState: UploadsSourceState;
  retry: () => void;
  retrying: boolean;
}

export interface UploadsSourceRetry {
  retry: () => void;
  retrying: boolean;
}

const InFlightUploadsContext = createContext<InFlightUploadsContextValue | undefined>(undefined);

export interface InFlightUploadsProviderProps<TFileOrigin extends string = string> {
  adapter: InFlightUploadsAdapter<TFileOrigin>;
  subscribe?: FirestoreSubscribeFn;
  children: ReactNode;
}

function fromParsed<TFileOrigin extends string>(
  parsed: ParsedPendingMedia<TFileOrigin>,
): InFlightUpload<TFileOrigin> {
  const base: InFlightUploadBase<TFileOrigin> = {
    id: parsed.id,
    fileOrigin: parsed.fileOrigin,
    surface: parsed.surface,
    createdAt: parsed.createdAt,
    targetIds: parsed.targetIds,
    originalContentType: parsed.originalContentType,
    originalSize: parsed.originalSize,
  };
  if (isPendingMediaNonTerminalStatus(parsed.status)) {
    return { ...base, status: parsed.status };
  }
  if (parsed.status === STATUS.completed) {
    return {
      ...base,
      status: STATUS.completed,
      completedAt: parsed.completedAt ?? parsed.createdAt,
      uploadTrayClearedAt: parsed.uploadTrayClearedAt,
      uploadTrayClearedBy: parsed.uploadTrayClearedBy,
      uploadTraySeenAt: parsed.uploadTraySeenAt,
      uploadTraySeenBy: parsed.uploadTraySeenBy,
    };
  }
  if (parsed.status === STATUS.failed) {
    return {
      ...base,
      status: STATUS.failed,
      failedAt: parsed.failedAt ?? parsed.createdAt,
      errorCategory: parsed.errorCategory ?? 'system',
      errorMessage: parsed.errorMessage ?? '',
      uploadTrayClearedAt: parsed.uploadTrayClearedAt,
      uploadTrayClearedBy: parsed.uploadTrayClearedBy,
      uploadTraySeenAt: parsed.uploadTraySeenAt,
      uploadTraySeenBy: parsed.uploadTraySeenBy,
    };
  }
  return {
    ...base,
    status: STATUS.rejected,
    rejectedAt: parsed.rejectedAt ?? parsed.createdAt,
    rejectionType: parsed.rejectionType ?? 'media',
    errorMessage: parsed.errorMessage ?? '',
    violationId: parsed.violationId,
    uploadTrayClearedAt: parsed.uploadTrayClearedAt,
    uploadTrayClearedBy: parsed.uploadTrayClearedBy,
    // Without the seen fields a seen rejected upload relights the Files dot forever.
    uploadTraySeenAt: parsed.uploadTraySeenAt,
    uploadTraySeenBy: parsed.uploadTraySeenBy,
  };
}

export function InFlightUploadsProvider<TFileOrigin extends string = string>(
  props: InFlightUploadsProviderProps<TFileOrigin>,
) {
  const { adapter, subscribe = defaultFirestoreSubscribe, children } = props;

  const [uploads, setUploads] = useState<Map<string, InFlightUpload<TFileOrigin>>>(new Map());
  const [sourceState, setSourceState] = useState<UploadsSourceState>('connecting');
  const [restarts, setRestarts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const restartRequestedRef = useRef(false);
  const seenTerminalIdsRef = useRef<Set<string>>(new Set());
  const statusByIdRef = useRef<Map<string, InFlightUploadStatus>>(new Map());
  const hasProcessedInitialSnapshotRef = useRef(false);
  const trackedUserIdRef = useRef<string | null>(null);

  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  });

  const userId = adapter.getCurrentUserId();

  useEffect(() => {
    // The dedup and tracking refs are identity-scoped: they survive a same-user resubscribe and reset
    // on any identity change, UID-A to UID-B with no sign-out between included.
    let restarting =
      restartRequestedRef.current && userId !== null && userId === trackedUserIdRef.current;
    restartRequestedRef.current = false;
    setUploads(new Map());
    if (!restarting) {
      setSourceState('connecting');
      setRetrying(false);
    }
    if (userId !== null && userId !== trackedUserIdRef.current) {
      seenTerminalIdsRef.current = new Set();
      statusByIdRef.current = new Map();
      trackedUserIdRef.current = userId;
    }
    hasProcessedInitialSnapshotRef.current = false;

    if (!userId) {
      return;
    }

    const a = adapterRef.current;
    const windowStartMs = Date.now() - a.listenerWindowMs;

    const handleSnapshot = (snapshot: FirestoreLikeSnapshot) => {
      const updates: Array<{ id: string; upload: InFlightUpload<TFileOrigin> | null }> = [];
      const newlyTerminal: Array<ParsedPendingMedia<TFileOrigin>> = [];
      const isInitialSnapshot = !hasProcessedInitialSnapshotRef.current;

      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          updates.push({ id: change.doc.id, upload: null });
          statusByIdRef.current.delete(change.doc.id);
          seenTerminalIdsRef.current.delete(change.doc.id);
          continue;
        }

        let parsed: ParsedPendingMedia<TFileOrigin>;
        try {
          parsed = adapterRef.current.parsePendingMedia(change.doc.data());
        } catch (error) {
          adapterRef.current.onMonitoringEvent({
            type: 'parse-error',
            docId: change.doc.id,
            error,
            data: change.doc.data(),
          });
          continue;
        }

        const upload = fromParsed(parsed);
        updates.push({ id: parsed.id, upload });

        const previousStatus = statusByIdRef.current.get(parsed.id);
        const currentStatus = parsed.status;
        const currentIsTerminal = isPendingMediaTerminalStatus(currentStatus);
        const previousWasNonTerminal = isPendingMediaNonTerminalStatus(previousStatus);

        if (isInitialSnapshot) {
          // A first snapshot re-lists current state: its terminal docs fire only when this instance tracked
          // them as non-terminal before.
          if (currentIsTerminal) {
            if (previousWasNonTerminal && !seenTerminalIdsRef.current.has(parsed.id)) {
              newlyTerminal.push(parsed);
            }
            seenTerminalIdsRef.current.add(parsed.id);
          }
        } else if (currentIsTerminal && !seenTerminalIdsRef.current.has(parsed.id)) {
          // A fast outcome can coalesce created and terminal into one delivery, so any unseen terminal fires.
          seenTerminalIdsRef.current.add(parsed.id);
          newlyTerminal.push(parsed);
        }

        statusByIdRef.current.set(parsed.id, currentStatus);
      }

      hasProcessedInitialSnapshotRef.current = true;

      const fromCache = snapshot.metadata?.fromCache ?? false;
      if (!(restarting && fromCache)) {
        setSourceState((prev) =>
          fromCache
            ? prev === 'connecting' || prev === 'error'
              ? 'connecting'
              : 'offline'
            : 'live',
        );
        restarting = false;
        setRetrying(false);
      }

      if (updates.length > 0) {
        setUploads((prev) => {
          const next = new Map(prev);
          for (const { id, upload } of updates) {
            if (upload === null) next.delete(id);
            else next.set(id, upload);
          }
          return next;
        });
      }

      for (const parsed of newlyTerminal) {
        handleTerminal(parsed);
      }
    };

    function handleTerminal(parsed: ParsedPendingMedia<TFileOrigin>) {
      adapterRef.current.onMonitoringEvent({
        type: 'breadcrumb',
        category: 'upload.terminal',
        level: 'info',
        message: `${parsed.fileOrigin}:${parsed.status}`,
        data: {
          id: parsed.id,
          fileOrigin: parsed.fileOrigin,
          status: parsed.status,
          surface: parsed.surface,
        },
      });

      if (parsed.status === STATUS.completed) {
        adapterRef.current.onUploadCompleted(parsed);
      } else if (parsed.status === STATUS.failed) {
        adapterRef.current.onUploadFailed(parsed);
      } else if (parsed.status === STATUS.rejected) {
        adapterRef.current.onUploadRejected(parsed);
      }
    }

    const RESUBSCRIBE_DELAYS_MS = [1_000, 3_000, 10_000, 30_000];
    let attempt = 0;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const start = () => {
      unsubscribe = subscribe({
        db: a.db,
        collectionPath: a.collectionPath,
        userId,
        windowStartMs,
        onSnapshot: (snapshot) => {
          attempt = 0;
          handleSnapshot(snapshot);
        },
        onError: (error) => {
          adapterRef.current.onMonitoringEvent({ type: 'listener-error', error });
          unsubscribe?.();
          unsubscribe = undefined;
          if (disposed || attempt >= RESUBSCRIBE_DELAYS_MS.length) {
            setSourceState('error');
            setRetrying(false);
            return;
          }
          if (!restarting) setSourceState('connecting');
          retryTimer = setTimeout(() => {
            if (disposed) return;
            attempt += 1;
            start();
          }, RESUBSCRIBE_DELAYS_MS[attempt]);
        },
      });
    };
    start();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe?.();
    };
  }, [userId, subscribe, restarts]);

  const retry = useCallback(() => {
    restartRequestedRef.current = true;
    setRetrying(true);
    setRestarts((count) => count + 1);
  }, []);

  const value = useMemo<InFlightUploadsContextValue<TFileOrigin>>(
    () => ({ uploads, sourceState, retry, retrying }),
    [uploads, sourceState, retry, retrying],
  );

  return (
    <InFlightUploadsContext.Provider value={value as InFlightUploadsContextValue}>
      {children}
    </InFlightUploadsContext.Provider>
  );
}

export function useInFlightUploadsState<TFileOrigin extends string = string>(): Map<
  string,
  InFlightUpload<TFileOrigin>
> {
  const ctx = useContext(InFlightUploadsContext);
  if (ctx === undefined) {
    throw new Error('useInFlightUploadsState must be used within InFlightUploadsProvider');
  }
  return ctx.uploads as Map<string, InFlightUpload<TFileOrigin>>;
}

export function useInFlightUpload<TFileOrigin extends string = string>(
  id: string | null | undefined,
): InFlightUpload<TFileOrigin> | undefined {
  const ctx = useContext(InFlightUploadsContext);
  if (ctx === undefined) {
    throw new Error('useInFlightUpload must be used within InFlightUploadsProvider');
  }
  if (!id) return undefined;
  return ctx.uploads.get(id) as InFlightUpload<TFileOrigin> | undefined;
}

export function useUploadsSourceState(): UploadsSourceState {
  const ctx = useContext(InFlightUploadsContext);
  if (ctx === undefined) {
    throw new Error('useUploadsSourceState must be used within InFlightUploadsProvider');
  }
  return ctx.sourceState;
}

export function useUploadsSourceRetry(): UploadsSourceRetry {
  const ctx = useContext(InFlightUploadsContext);
  if (ctx === undefined) {
    throw new Error('useUploadsSourceRetry must be used within InFlightUploadsProvider');
  }
  return { retry: ctx.retry, retrying: ctx.retrying };
}

export function isTerminalUpload<TFileOrigin extends string = string>(
  item: InFlightUpload<TFileOrigin>,
): item is Exclude<InFlightUpload<TFileOrigin>, { status: PendingMediaNonTerminalStatus }> {
  return isPendingMediaTerminalStatus(item.status);
}

export function useUploadActivityState<
  TFileOrigin extends string = string,
>(): InFlightUpload<TFileOrigin>[] {
  const uploads = useInFlightUploadsState<TFileOrigin>();
  return useMemo(() => {
    return Array.from(uploads.values())
      .filter((item) => {
        if (!isTerminalUpload(item)) return true;
        return item.uploadTrayClearedAt === undefined;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [uploads]);
}

// A static ESM import, never require(): under Next.js + Turbopack a CJS-loaded firebase/firestore
// is another module instance and rejects a db built through ESM.
const defaultFirestoreSubscribe: FirestoreSubscribeFn = (args) => {
  const q = query(
    collection(args.db as Firestore, args.collectionPath),
    where('userId', '==', args.userId),
    where('createdAt', '>=', args.windowStartMs),
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    args.onSnapshot as never,
    args.onError as never,
  );
};
