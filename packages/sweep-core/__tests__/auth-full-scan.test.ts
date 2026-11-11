import { describe, expect, it } from 'vitest';
import { AUTH_LIST_USERS_PAGE_SIZE } from '../src/sweep-state.js';
import { runAuthFullScanLap } from '../src/server/auth-full-scan.js';
import type { SweepUserLister, SweepUserPage } from '../src/server/auth-full-scan.js';
import { statePath, sweepFixture } from './helpers.js';

interface FakeUser {
  uid: string;
}

function lister(pages: Record<string, SweepUserPage<FakeUser>>) {
  const calls: Array<string | undefined> = [];
  const users: SweepUserLister<FakeUser> = {
    listUsers: async (maxResults, pageToken) => {
      calls.push(pageToken);
      expect(maxResults).toBe(AUTH_LIST_USERS_PAGE_SIZE);
      const page = pages[pageToken ?? 'first'];
      if (!page) throw Object.assign(new Error('bad token'), { code: 'auth/invalid-page-token' });
      return page;
    },
  };
  return { users, calls };
}

const usersNamed = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ uid: `${prefix}${i}` }));

describe('the Auth full scan', () => {
  it('saves the page after every page and stops a run at its budget', async () => {
    const { memory, store } = sweepFixture();
    const { users } = lister({
      first: { users: usersNamed('a', 1000), pageToken: 'p2' },
      p2: { users: usersNamed('b', 1000), pageToken: 'p3' },
      p3: { users: usersNamed('c', 10) },
    });
    const visited: string[] = [];
    const run = await runAuthFullScanLap({
      store,
      name: 'alpha',
      now: 1000,
      minIntervalMs: 0,
      users,
      visit: async (user) => {
        visited.push(user.uid);
      },
    });
    expect(run).toEqual({ ran: true, examined: 2000, lapComplete: false, lapRestarted: false });
    expect(visited).toHaveLength(2000);
    expect(memory.read(statePath('alpha'))).toEqual({
      updatedAt: 1000,
      fullScanLap: { pageToken: 'p3', lapStartedAt: 1000 },
    });
  });

  it('resumes the lap at the saved page, and on its last page records the finished scan', async () => {
    const { memory, store } = sweepFixture();
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      fullScanLap: { pageToken: 'p3', lapStartedAt: 900 },
      rollingCursor: { state: 'inLap', afterKey: 'x', lapStartedAt: 1 },
    });
    const { users, calls } = lister({ p3: { users: usersNamed('c', 3) } });
    const run = await runAuthFullScanLap({
      store,
      name: 'alpha',
      now: 2000,
      minIntervalMs: 999_999,
      users,
      visit: async () => {},
    });
    expect(calls).toEqual(['p3']);
    expect(run).toEqual({ ran: true, examined: 3, lapComplete: true, lapRestarted: false });
    expect(memory.read(statePath('alpha'))).toEqual({
      updatedAt: 2000,
      fullScanLastRunAt: 2000,
      rollingCursor: { state: 'inLap', afterKey: 'x', lapStartedAt: 1 },
    });
  });

  it('restarts the lap from the first page when Firebase no longer accepts the saved page', async () => {
    const { memory, store } = sweepFixture();
    memory.seed(statePath('alpha'), {
      updatedAt: 1,
      fullScanLap: { pageToken: 'expired', lapStartedAt: 900 },
    });
    const { users, calls } = lister({ first: { users: usersNamed('a', 2) } });
    const run = await runAuthFullScanLap({
      store,
      name: 'alpha',
      now: 3000,
      minIntervalMs: 0,
      users,
      visit: async () => {},
    });
    expect(calls).toEqual(['expired', undefined]);
    expect(run).toEqual({ ran: true, examined: 2, lapComplete: true, lapRestarted: true });
  });

  it('does not start a new lap before its minimum interval has passed', async () => {
    const { memory, store } = sweepFixture();
    memory.seed(statePath('alpha'), { updatedAt: 1, fullScanLastRunAt: 1000 });
    const { users, calls } = lister({ first: { users: [] } });
    const run = await runAuthFullScanLap({
      store,
      name: 'alpha',
      now: 1500,
      minIntervalMs: 1000,
      users,
      visit: async () => {},
    });
    expect(run.ran).toBe(false);
    expect(calls).toEqual([]);
  });

  it('fails the run on any other listing failure', async () => {
    const { store } = sweepFixture();
    const users: SweepUserLister<FakeUser> = {
      listUsers: async () => {
        throw Object.assign(new Error('down'), { code: 'auth/internal-error' });
      },
    };
    await expect(
      runAuthFullScanLap({
        store,
        name: 'alpha',
        now: 1,
        minIntervalMs: 0,
        users,
        visit: async () => {},
      }),
    ).rejects.toThrow('down');
  });
});
