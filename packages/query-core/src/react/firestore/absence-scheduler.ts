'use client';

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { clientScoped } from './client-scoped.js';
import { queryHashOf as hashOf } from './query-hash.js';

export const ABSENT_RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000] as const;

type Episode = {
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

type Registration = {
  delays: readonly number[];
};

type Tracked = {
  queryKey: QueryKey;
  registrations: Registration[];
};

type SchedulerState = {
  episodes: Map<string, Episode>;
  tracked: Map<string, Tracked>;
};

const NO_DELAYS: readonly number[] = [];

function effectiveDelays(tracked: Tracked | undefined): readonly number[] {
  if (!tracked) return NO_DELAYS;
  let longest: readonly number[] = NO_DELAYS;
  for (const registration of tracked.registrations) {
    if (registration.delays.length > longest.length) longest = registration.delays;
  }
  return longest;
}

function clearTimer(episode: Episode | undefined): void {
  if (episode?.timer != null) {
    clearTimeout(episode.timer);
    episode.timer = null;
  }
}

function discardEpisode(state: SchedulerState, hash: string): void {
  clearTimer(state.episodes.get(hash));
  state.episodes.delete(hash);
}

function schedule(queryClient: QueryClient, state: SchedulerState, hash: string): void {
  const tracked = state.tracked.get(hash);
  const episode = state.episodes.get(hash);
  if (!tracked || !episode || episode.timer !== null) return;

  const delays = effectiveDelays(tracked);
  if (episode.attempt >= delays.length) return;

  episode.timer = setTimeout(() => {
    episode.timer = null;
    episode.attempt += 1;
    const current = state.tracked.get(hash);
    if (!current || !isAbsentAndActive(queryClient, hash)) return;
    void queryClient.refetchQueries({ queryKey: current.queryKey, exact: true, type: 'active' });
    evaluate(queryClient, state, hash);
  }, delays[episode.attempt]);
}

function isAbsentAndActive(queryClient: QueryClient, hash: string): boolean {
  const query = queryClient.getQueryCache().get(hash);
  if (!query) return false;
  return query.state.status === 'success' && query.state.data === null && query.isActive();
}

function evaluate(queryClient: QueryClient, state: SchedulerState, hash: string): void {
  const query = queryClient.getQueryCache().get(hash);
  if (!query) {
    discardEpisode(state, hash);
    return;
  }

  const { status, data } = query.state;

  if (status === 'success' && data !== null) {
    discardEpisode(state, hash);
    return;
  }

  if (status !== 'success') {
    clearTimer(state.episodes.get(hash));
    return;
  }

  const tracked = state.tracked.get(hash);
  if (!tracked) {
    clearTimer(state.episodes.get(hash));
    return;
  }

  let episode = state.episodes.get(hash);
  if (!episode) {
    if (effectiveDelays(tracked).length === 0) return;
    episode = { attempt: 0, timer: null };
    state.episodes.set(hash, episode);
  }

  if (!query.isActive()) {
    clearTimer(episode);
    return;
  }

  schedule(queryClient, state, hash);
}

const getState = clientScoped((queryClient): SchedulerState => {
  const scheduler: SchedulerState = { episodes: new Map(), tracked: new Map() };
  queryClient.getQueryCache().subscribe((event) => {
    const hash = event.query.queryHash;
    if (!scheduler.tracked.has(hash) && !scheduler.episodes.has(hash)) return;
    if (event.type === 'removed') {
      discardEpisode(scheduler, hash);
      return;
    }
    evaluate(queryClient, scheduler, hash);
  });
  return scheduler;
});

export interface TrackAbsentDocParams {
  queryClient: QueryClient;
  queryKey: QueryKey;
  delays?: readonly number[];
}

export function trackAbsentDoc({
  queryClient,
  queryKey,
  delays = ABSENT_RETRY_DELAYS_MS,
}: TrackAbsentDocParams): () => void {
  const state = getState(queryClient);
  const hash = hashOf(queryClient, queryKey);
  const registration: Registration = { delays };

  const existing = state.tracked.get(hash);
  if (existing) existing.registrations.push(registration);
  else state.tracked.set(hash, { queryKey, registrations: [registration] });

  evaluate(queryClient, state, hash);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = state.tracked.get(hash);
    if (!current) return;

    const before = effectiveDelays(current).length;
    const index = current.registrations.indexOf(registration);
    if (index >= 0) current.registrations.splice(index, 1);

    if (current.registrations.length === 0) {
      state.tracked.delete(hash);
      clearTimer(state.episodes.get(hash));
      return;
    }

    if (effectiveDelays(current).length !== before) {
      clearTimer(state.episodes.get(hash));
      evaluate(queryClient, state, hash);
    }
  };
}

export function __absenceEpisodeCount(queryClient: QueryClient): number {
  return getState.peek(queryClient)?.episodes.size ?? 0;
}

export function __absenceAttempt(queryClient: QueryClient, queryKey: QueryKey): number | null {
  return getState.peek(queryClient)?.episodes.get(hashOf(queryClient, queryKey))?.attempt ?? null;
}
