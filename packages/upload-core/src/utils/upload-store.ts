import type { UploadSessionState } from "../types";
import type { UploadSessionPersistenceAdapter } from "../types";

type Listener = (s: UploadSessionState) => void;

const sessions = new Map<string, UploadSessionState>();
const listeners = new Map<string, Set<Listener>>();

let persistence: UploadSessionPersistenceAdapter | null = null;

export function setUploadSessionPersistence(adapter: UploadSessionPersistenceAdapter | null) {
  persistence = adapter;
}

async function persistUpsert(state: UploadSessionState) {
  try {
    await persistence?.set(state.id, state);
  } catch {}
}

async function persistRemove(id: string) {
  try {
    await persistence?.remove(id);
  } catch {}
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
    } catch {}
  }
}

function now() {
  return Date.now();
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
  // If caller provides an explicit updatedAt that's older than what we already have, ignore.
  if (prev && partial.updatedAt != null && partial.updatedAt < prev.updatedAt) {
    return;
  }

  const prevStatus = prev?.status ?? "idle";
  const prevIsTerminal = prevStatus === "success" || prevStatus === "error" || prevStatus === "canceled";
  const nextStatus = partial.status ?? prevStatus;
  const status = prevIsTerminal ? prevStatus : nextStatus;

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
