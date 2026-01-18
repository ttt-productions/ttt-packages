import type { UploadSessionState } from "../types";

type Listener = (s: UploadSessionState) => void;

const sessions = new Map<string, UploadSessionState>();
const listeners = new Map<string, Set<Listener>>();

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
  const next: UploadSessionState = {
    id: partial.id,
    status: partial.status ?? prev?.status ?? "idle",
    path: partial.path ?? prev?.path ?? "",

    transferred: partial.transferred ?? prev?.transferred ?? 0,
    total: partial.total ?? prev?.total ?? 0,
    percent: partial.percent ?? prev?.percent ?? 0,

    startedAt: partial.startedAt ?? prev?.startedAt ?? now(),
    updatedAt: partial.updatedAt ?? now(),

    error: partial.error ?? prev?.error,
    result: partial.result ?? prev?.result,
  };

  sessions.set(partial.id, next);

  const ls = listeners.get(partial.id);
  if (ls) for (const fn of ls) fn(next);
}

export function removeUploadSession(id: string) {
  sessions.delete(id);
  const ls = listeners.get(id);
  if (ls) listeners.delete(id);
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
