'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SANCTIONED EXCEPTION to the "packages read/write Firestore only through
// @ttt-productions/query-core" rule (see docs/packages/package-architecture.md →
// "Firestore access goes through query-core").
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
// ─────────────────────────────────────────────────────────────────────────────
import { collection, onSnapshot, query, where } from 'firebase/firestore';

/**
 * Generic in-flight uploads provider.
 *
 * Provides a global Map of in-flight upload state by `pendingMediaId`, derived
 * from a Firestore listener over the consumer-supplied collection. On terminal
 * status transitions observed THIS SESSION, fires consumer-supplied success /
 * failure / rejection callbacks. Records monitoring breadcrumbs and parse
 * errors through the injected monitoring callback.
 *
 * EVERY app-specific value is supplied by the consumer:
 *  - userId resolution
 *  - Firestore `db` reference
 *  - collection path
 *  - listener time window (ms)
 *  - parser/schema for raw Firestore doc → typed PendingMedia
 *  - success copy per origin
 *  - notification callback (cache invalidation, etc.)
 *  - toast callback
 *  - rejection callback (for the media-rejection dialog or equivalent)
 *  - monitoring callback (breadcrumbs + captured errors)
 *
 * Read APIs:
 *  - `useInFlightUploadsState()` — full Map.
 *  - `useInFlightUpload(id)` — single doc, narrowable on status.
 *  - `useUploadActivityState()` — tray-visible items, sorted newest-first.
 *
 * The package owns the deduplication, initial-snapshot suppression, and
 * non-terminal → terminal transition tracking. It does NOT own anything about
 * what a file-origin is or what message text appears in toasts.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// =============================================================================
// Generic shape of the data the provider tracks
// =============================================================================

/**
 * Generic pending-media status. Defined here so upload-ui has no dependency
 * on any app-specific package.
 */
export type InFlightUploadStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

/**
 * Generic in-flight upload record. The provider keeps a Map<id, InFlightUpload>
 * built from each parsed PendingMedia. Consumers parameterize the `fileOrigin`
 * type via the parser's return type (the provider treats it as opaque).
 *
 * `TFileOrigin` defaults to `string` so unannotated consumers get a permissive
 * shape; consuming apps bind it to their own `FileOrigin` union at the call site.
 */
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
    status: 'pending' | 'processing';
  };

export type InFlightUploadCompleted<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: 'completed';
    completedAt: number;
    uploadTrayClearedAt?: number;
    uploadTrayClearedBy?: string;
    uploadTraySeenAt?: number;
    uploadTraySeenBy?: string;
  };

export type InFlightUploadFailed<TFileOrigin extends string = string> =
  InFlightUploadBase<TFileOrigin> & {
    status: 'failed';
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
    status: 'rejected';
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

// =============================================================================
// Adapter contract — every app-specific behavior is injected here
// =============================================================================

/**
 * Result of the consumer-supplied parser. The provider keeps the raw parsed
 * record for callbacks (so consumers can read domain events, target IDs, etc.)
 * AND derives the generic InFlightUpload from it for the public Map.
 *
 * The parser MUST throw if validation fails; the provider catches and routes
 * the error to the monitoring callback.
 */
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
  // Terminal-status fields (only meaningful for the matching status)
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
  /**
   * Opaque consumer-controlled domain-event payload, surfaced to the
   * `onUploadCompleted` and `onUploadRejected` callbacks for cache
   * invalidation. The provider does not interpret it.
   */
  domainEvents?: unknown;
};

export type InFlightUploadsAdapter<TFileOrigin extends string = string> = {
  /** Returns the current user's uid, or null if not signed in. */
  getCurrentUserId: () => string | null;

  /** Firestore database adapter (loose typing — `unknown` keeps zero firebase coupling at the type level). */
  db: unknown;

  /** Collection path holding pending-media docs (e.g. "pendingMedia"). */
  collectionPath: string;

  /** Listener window in milliseconds — only docs with `createdAt >= now - window` are tracked. */
  listenerWindowMs: number;

  /**
   * Parse a raw Firestore doc snapshot's `.data()` into the generic shape the
   * provider tracks. Throws on validation failure; the provider routes thrown
   * errors to `onMonitoringEvent`.
   */
  parsePendingMedia: (raw: unknown) => ParsedPendingMedia<TFileOrigin>;

  /** Called once per observed non-terminal → terminal completed transition. */
  onUploadCompleted: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  /** Called once per observed non-terminal → terminal failed transition. */
  onUploadFailed: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  /** Called once per observed non-terminal → terminal rejected transition. */
  onUploadRejected: (parsed: ParsedPendingMedia<TFileOrigin>) => void;

  /**
   * Monitoring callback. Receives:
   *  - `breadcrumb`: informational, fired on every observed terminal transition.
   *  - `parse-error`: when `parsePendingMedia` throws.
   *  - `listener-error`: when the Firestore listener's error callback fires.
   *
   * Consumers wire this to Sentry, OpenTelemetry, or any other observability
   * provider. The provider does NOT import any monitoring SDK directly.
   */
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

// =============================================================================
// Firestore subscription contract — abstracted to avoid firebase coupling
// =============================================================================

/**
 * Minimal subscription contract used by the provider. The default
 * implementation lives in `firestore-subscribe.ts` and uses the standard
 * `firebase/firestore` `onSnapshot` + `query` + `where` builders.
 *
 * Tests inject a fake to drive the listener without spinning up Firestore.
 */
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
};

export type FirestoreLikeDocChange = {
  type: 'added' | 'modified' | 'removed';
  doc: {
    id: string;
    data: () => unknown;
  };
};

// =============================================================================
// Provider
// =============================================================================

interface InFlightUploadsContextValue<TFileOrigin extends string = string> {
  uploads: Map<string, InFlightUpload<TFileOrigin>>;
}

const InFlightUploadsContext = createContext<InFlightUploadsContextValue | undefined>(undefined);

export interface InFlightUploadsProviderProps<TFileOrigin extends string = string> {
  adapter: InFlightUploadsAdapter<TFileOrigin>;
  /** Firestore subscription function. Defaults to the firebase/firestore implementation. */
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
  if (parsed.status === 'pending' || parsed.status === 'processing') {
    return { ...base, status: parsed.status };
  }
  if (parsed.status === 'completed') {
    return {
      ...base,
      status: 'completed',
      completedAt: parsed.completedAt ?? parsed.createdAt,
      uploadTrayClearedAt: parsed.uploadTrayClearedAt,
      uploadTrayClearedBy: parsed.uploadTrayClearedBy,
      uploadTraySeenAt: parsed.uploadTraySeenAt,
      uploadTraySeenBy: parsed.uploadTraySeenBy,
    };
  }
  if (parsed.status === 'failed') {
    return {
      ...base,
      status: 'failed',
      failedAt: parsed.failedAt ?? parsed.createdAt,
      errorCategory: parsed.errorCategory ?? 'system',
      errorMessage: parsed.errorMessage ?? '',
      uploadTrayClearedAt: parsed.uploadTrayClearedAt,
      uploadTrayClearedBy: parsed.uploadTrayClearedBy,
      uploadTraySeenAt: parsed.uploadTraySeenAt,
      uploadTraySeenBy: parsed.uploadTraySeenBy,
    };
  }
  // rejected
  return {
    ...base,
    status: 'rejected',
    rejectedAt: parsed.rejectedAt ?? parsed.createdAt,
    rejectionType: parsed.rejectionType ?? 'media',
    errorMessage: parsed.errorMessage ?? '',
    violationId: parsed.violationId,
    uploadTrayClearedAt: parsed.uploadTrayClearedAt,
    uploadTrayClearedBy: parsed.uploadTrayClearedBy,
  };
}

export function InFlightUploadsProvider<TFileOrigin extends string = string>(
  props: InFlightUploadsProviderProps<TFileOrigin>,
) {
  const { adapter, subscribe = defaultFirestoreSubscribe, children } = props;

  const [uploads, setUploads] = useState<Map<string, InFlightUpload<TFileOrigin>>>(new Map());
  const seenTerminalIdsRef = useRef<Set<string>>(new Set());
  const statusByIdRef = useRef<Map<string, InFlightUploadStatus>>(new Map());
  const hasProcessedInitialSnapshotRef = useRef(false);

  // Stable refs for adapter callbacks — read from latest adapter inside effect.
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  });

  const userId = adapter.getCurrentUserId();

  useEffect(() => {
    // Reset all in-memory state for the new identity. Runs on every userId
    // change — including UID-A → UID-B with no intermediate null user.
    // Do not rely on an intermediate sign-out to clear refs between two
    // authenticated UIDs.
    setUploads(new Map());
    seenTerminalIdsRef.current = new Set();
    statusByIdRef.current = new Map();
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
        const currentIsTerminal =
          currentStatus === 'completed' ||
          currentStatus === 'failed' ||
          currentStatus === 'rejected';
        const previousWasNonTerminal =
          previousStatus === 'pending' || previousStatus === 'processing';

        if (isInitialSnapshot) {
          // First snapshot after mount: mark already-terminal docs as seen,
          // but DO NOT fire callbacks. Prevents duplicate toasts on refresh.
          if (currentIsTerminal) {
            seenTerminalIdsRef.current.add(parsed.id);
          }
        } else if (
          currentIsTerminal &&
          previousWasNonTerminal &&
          !seenTerminalIdsRef.current.has(parsed.id)
        ) {
          seenTerminalIdsRef.current.add(parsed.id);
          newlyTerminal.push(parsed);
        } else if (currentIsTerminal) {
          // Terminal doc appeared without an observed non-terminal predecessor
          // (race in a non-initial snapshot). Mark as seen, no callback fire.
          seenTerminalIdsRef.current.add(parsed.id);
        }

        statusByIdRef.current.set(parsed.id, currentStatus);
      }

      hasProcessedInitialSnapshotRef.current = true;

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

      if (parsed.status === 'completed') {
        adapterRef.current.onUploadCompleted(parsed);
      } else if (parsed.status === 'failed') {
        adapterRef.current.onUploadFailed(parsed);
      } else if (parsed.status === 'rejected') {
        adapterRef.current.onUploadRejected(parsed);
      }
    }

    const unsubscribe = subscribe({
      db: a.db,
      collectionPath: a.collectionPath,
      userId,
      windowStartMs,
      onSnapshot: handleSnapshot,
      onError: (error) => {
        adapterRef.current.onMonitoringEvent({ type: 'listener-error', error });
      },
    });

    return () => {
      unsubscribe();
    };
    // adapter is intentionally NOT in the deps array — adapter is read via
    // adapterRef on every snapshot, so identity changes don't re-subscribe.
     
  }, [userId, subscribe]);

  const value = useMemo<InFlightUploadsContextValue<TFileOrigin>>(
    () => ({ uploads }),
    [uploads],
  );

  return (
    <InFlightUploadsContext.Provider value={value as InFlightUploadsContextValue}>
      {children}
    </InFlightUploadsContext.Provider>
  );
}

// =============================================================================
// Read APIs
// =============================================================================

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

// =============================================================================
// Tray helpers
// =============================================================================

/**
 * `true` for `completed` / `failed` / `rejected`. Used by tray UI to decide
 * whether a Clear action is available for an item.
 */
export function isTerminalUpload<TFileOrigin extends string = string>(
  item: InFlightUpload<TFileOrigin>,
): item is Exclude<InFlightUpload<TFileOrigin>, { status: 'pending' | 'processing' }> {
  return (
    item.status === 'completed' ||
    item.status === 'failed' ||
    item.status === 'rejected'
  );
}

/**
 * Tray-visible items. Includes every pending/processing upload, plus terminal
 * uploads that have NOT been cleared from the tray. Sorted newest-first by
 * createdAt.
 *
 * The public selector name in upload-ui is `useUploadActivityState`. The
 * mutation hook is `useClearUploadActivity` (in a separate file).
 */
export function useUploadActivityState<TFileOrigin extends string = string>(): InFlightUpload<TFileOrigin>[] {
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

// =============================================================================
// Default Firestore subscription implementation
// =============================================================================

/**
 * Default Firestore subscription using the consumer's `firebase/firestore`
 * module instance (via static ESM import at the top of this file).
 *
 * Using static ESM import — NOT `require()` — is load-bearing. CommonJS
 * `require('firebase/firestore')` and ESM `import 'firebase/firestore'` resolve
 * to different module instances under Next.js + Turbopack. If the consumer
 * constructs `db` via ESM and we receive it here, but we then call
 * `collection()` from a CJS-loaded copy of firebase, the firebase runtime
 * does not recognize the db as a Firestore instance and throws
 * "Expected first argument to collection() to be a CollectionReference,
 *  a DocumentReference or FirebaseFirestore".
 *
 * Consumers who want to skip the firebase code path entirely (tests, alt
 * backends) supply their own `subscribe` prop to `InFlightUploadsProvider`.
 */
const defaultFirestoreSubscribe: FirestoreSubscribeFn = (args) => {
  const q = query(
     
    collection(args.db as any, args.collectionPath),
    where('userId', '==', args.userId),
    where('createdAt', '>=', args.windowStartMs),
  );
  return onSnapshot(q, args.onSnapshot as never, args.onError as never);
};
