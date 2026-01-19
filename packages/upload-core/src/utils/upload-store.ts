import type { UploadSessionState, UploadSessionPersistenceAdapter } from "../types";

type Listener = (s: UploadSessionState) => void;

const sessions = new Map<string, UploadSessionState>();
const listeners = new Map<string, Set<Listener>>();

let persistence: UploadSessionPersistenceAdapter | null = null;

export function setUploadSessionPersistence(adapter: UploadSessionPersistenceAdapter | null) {
  persistence = adapter;
}

export type PersistenceErrorHandler = (err: unknown, op: "set" | "remove" | "get", id: string) => void;

let persistenceErrorHandler: PersistenceErrorHandler | null = null;

export function setUploadSessionPersistenceErrorHandler(handler: PersistenceErrorHandler | null) {
  persistenceErrorHandler = handler;
}

async function persistUpsert(state: UploadSessionState) {
  try {
    await persistence?.set(state.id, state);
  } catch (err) {
    console.error("[upload-store] Failed to persist session:", state.id, err);
    persistenceErrorHandler?.(err, "set", state.id);
  }
}

async function persistRemove(id: string) {
  try {
    await persistence?.remove(id);
  } catch (err) {
    console.error("[upload-store] Failed to remove persisted session:", id, err);
    persistenceErrorHandler?.(err, "remove", id);
  }
}

function now() {
  return Date.now();
}

const MAX_SESSIONS = 100;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const ERROR_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d (error + canceled)

export function pruneOldUploadSessions() {
  const t = Date.now();
  const all = listUploadSessions();

  let pruned = 0;

  for (const s of all) {
    if (s.status === "success" && t - s.updatedAt > SUCCESS_TTL_MS) {
      removeUploadSession(s.id);
      pruned++;
    } else if ((s.status === "error" || s.status === "canceled") && t - s.updatedAt > ERROR_TTL_MS) {
      removeUploadSession(s.id);
      pruned++;
    }
  }

  const remaining = listUploadSessions();
  if (remaining.length > MAX_SESSIONS) {
    for (const s of remaining.slice(MAX_SESSIONS)) {
      removeUploadSession(s.id);
      pruned++;
    }
  }

  return pruned;
}

/** Load persisted sessions into the in-memory store.
 *
 * Note: Firebase resumable tasks cannot be reattached after a full reload.
 * Persisted sessions exist for UI recovery and restart flows.
 */
export async function rehydrateUploadSessions() {
  if (!persistence) return;
  const ids = await persistence.listIds();
  for (const id of ids) {
    try {
      const s = await persistence.get(id);
      if (s) sessions.set(id, s);
    } catch (err) {
      console.error("[upload-store] Failed to read persisted session:", id, err);
      persistenceErrorHandler?.(err, "get", id);
    }
  }

  pruneOldUploadSessions();
}

export function getUploadSession(id: string): UploadSessionState | undefined {
  return sessions.get(id);
}

export function listUploadSessions(): UploadSessionState[] {
  return Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertUploadSession(partial: Partial<UploadSessionState> & Pick<UploadSessionState, "id">) {
  const prev = sessions.get(partial.id);

  // Guard against out-of-order async updates.
  if (prev && partial.updatedAt != null && partial.updatedAt < prev.updatedAt) {
    return;
  }

  const prevStatus = prev?.status ?? "idle";
  const nextStatus = partial.status ?? prevStatus;

  const isTerminal = (s: string) => s === "success" || s === "error" || s === "canceled";
  const prevIsTerminal = isTerminal(prevStatus);
  const nextIsTerminal = isTerminal(nextStatus);

  // Once terminal, stay terminal. If we receive a terminal nextStatus first, accept it.
  const status = prevIsTerminal ? prevStatus : nextIsTerminal ? nextStatus : nextStatus;

  // Progress values should never go backwards.
  const transferred = Math.max(partial.transferred ?? 0, prev?.transferred ?? 0);
  const total = Math.max(partial.total ?? 0, prev?.total ?? 0);
  const percent = Math.max(partial.percent ?? 0, prev?.percent ?? 0);

  const version = (prev?.version ?? 0) + 1;
  const next: UploadSessionState = {
    id: partial.id,
    status,
    path: partial.path ?? prev?.path ?? "",
    version,
    transferred,
    total,
    percent,
    startedAt: partial.startedAt ?? prev?.startedAt ?? now(),
    updatedAt: partial.updatedAt ?? now(),
    error: partial.error ?? prev?.error,
    result: partial.result ?? prev?.result,
  };

  sessions.set(partial.id, next);
  void persistUpsert(next);

  const ls = listeners.get(partial.id);
  if (ls) for (const fn of ls) fn(next);
}

export function removeUploadSession(id: string) {
  sessions.delete(id);
  clearUploadSessionListeners(id);
  void persistRemove(id);
}

export function clearUploadSessionListeners(id: string) {
  if (listeners.has(id)) listeners.delete(id);
}

export function subscribeUploadSession(id: string, fn: Listener): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);

  const current = sessions.get(id);
  if (current) fn(current);

  return () => {
    const s = listeners.get(id);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) listeners.delete(id);
  };
}
