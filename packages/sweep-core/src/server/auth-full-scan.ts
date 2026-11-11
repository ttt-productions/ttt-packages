import { AUTH_FULL_SCAN_EXAMINED_PER_RUN, AUTH_LIST_USERS_PAGE_SIZE } from '../sweep-state.js';
import type { SweepStateStore } from './sweep-state-store.js';

export interface SweepUserPage<User> {
  readonly users: readonly User[];
  readonly pageToken?: string;
}

export interface SweepUserLister<User> {
  listUsers(maxResults?: number, pageToken?: string): Promise<SweepUserPage<User>>;
}

export interface AuthFullScanRequest<Name extends string, User> {
  readonly store: SweepStateStore<Name>;
  readonly name: Name;
  readonly now: number;
  readonly minIntervalMs: number;
  readonly users: SweepUserLister<User>;
  readonly visit: (user: User) => Promise<void>;
}

export interface AuthFullScanRun {
  readonly ran: boolean;
  readonly examined: number;
  readonly lapComplete: boolean;
  readonly lapRestarted: boolean;
}

function isInvalidPageToken(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'auth/invalid-page-token';
}

export async function runAuthFullScanLap<Name extends string, User>(
  request: AuthFullScanRequest<Name, User>,
): Promise<AuthFullScanRun> {
  const { store, name, now, minIntervalMs, users, visit } = request;
  const state = await store.read(name);
  const inProgress = state?.fullScanLap;
  if (!inProgress && now - (state?.fullScanLastRunAt ?? 0) < minIntervalMs) {
    return { ran: false, examined: 0, lapComplete: false, lapRestarted: false };
  }

  let lapStartedAt = inProgress?.lapStartedAt ?? now;
  let pageToken = inProgress?.pageToken;
  let examined = 0;
  let lapRestarted = false;

  for (;;) {
    let page: SweepUserPage<User>;
    try {
      page = await users.listUsers(AUTH_LIST_USERS_PAGE_SIZE, pageToken);
    } catch (error) {
      if (pageToken !== undefined && isInvalidPageToken(error)) {
        pageToken = undefined;
        lapStartedAt = now;
        lapRestarted = true;
        continue;
      }
      throw error;
    }
    for (const user of page.users) {
      await visit(user);
      examined += 1;
    }
    if (!page.pageToken) {
      await store.update(name, { fullScanLap: null, fullScanLastRunAt: now }, now);
      return { ran: true, examined, lapComplete: true, lapRestarted };
    }
    pageToken = page.pageToken;
    await store.update(name, { fullScanLap: { pageToken, lapStartedAt } }, now);
    if (examined >= AUTH_FULL_SCAN_EXAMINED_PER_RUN) {
      return { ran: true, examined, lapComplete: false, lapRestarted };
    }
  }
}
