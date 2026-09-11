'use client';

import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Bounded re-read ladder for a document that resolved ABSENT.
 *
 * A one-shot lookup that lands `null` has no listener to tell it when the doc appears —
 * the row would stay blank until something invalidates it. That is the real failure the
 * realtime path was introduced to fix (a mirror doc that is missing or lagging at fetch
 * time: just after a create-and-redirect, or in a second tab racing the server mirror).
 * This scheduler restores the recovery without a listener: after an absent result it
 * re-reads a few times on a widening ladder, then gives up.
 *
 * Delays (ms) between re-reads within one absence episode. After the last rung the episode
 * is exhausted and never restarts on its own; only a later PRESENT→absent transition opens
 * a new one.
 */
export const ABSENT_RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000] as const;

/**
 * The rules the scheduler holds to:
 *
 * - It polls ONLY a query in `status: 'success'` whose data is `null`. An error state is
 *   never polled (a denial is not an absence), and an error mid-episode pauses the ladder
 *   with its remaining budget intact.
 * - One timer per query key and one budget per absence episode: the first successful
 *   `undefined → null` opens the episode, and neither a repeated `null` nor an additional
 *   consumer resets it. A `present → null` transition opens a NEW episode.
 * - Several consumers may register the same key with DIFFERENT ladders. The effective
 *   ladder is the union: poll if any registrant wants polling, using the LONGEST ladder
 *   among them, recomputed on every register and release. Mount order never decides.
 * - Eligibility is TanStack's `query.isActive()` — at least one observer that is not
 *   disabled. Subscribe-mode and disabled observers therefore never keep an episode
 *   polling, while disabling ONE consumer cannot stop polling another still needs.
 * - Losing the last enabled observer PAUSES the ladder and retains the episode's remaining
 *   rungs; a later enabled observer resumes from there. A new observer on an EXHAUSTED
 *   episode does not restart it.
 * - Cache removal (gc) discards the episode outright, so a later re-fetch that lands absent
 *   starts fresh.
 *
 * Because the timer is per key rather than per observer, N consumers of one absent id cost
 * one re-read per rung, not N.
 */

type Episode = {
  /** Rungs consumed so far; `>= effectiveDelays().length` means exhausted. */
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

// Per-QueryClient, like the doc-subscription registry: a discarded client is GC'd with its
// bookkeeping, and each browser tab schedules independently.
const schedulers = new WeakMap<QueryClient, SchedulerState>();

/**
 * Hash a key the way THIS client hashes it, so a consumer with a custom
 * `queryKeyHashFn` still lines up with `QueryCache.get()`.
 */
function hashOf(queryClient: QueryClient, queryKey: QueryKey): string {
  return queryClient.defaultQueryOptions({ queryKey }).queryHash;
}

/** Union of the registrants' ladders: the longest one wins; none means no polling. */
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
    // Lay the next rung; the ladder stops the moment the doc appears, the budget runs
    // out, or the last enabled observer goes away.
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
    // The doc is present — the episode is over.
    discardEpisode(state, hash);
    return;
  }

  if (status !== 'success') {
    // Pending or errored: never polled, but the budget survives so an error mid-episode
    // cannot hand the id a fresh ladder when it returns to absent.
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
    // No registrant wants polling — do not open an episode that could never spend a rung.
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

function getState(queryClient: QueryClient): SchedulerState {
  let state = schedulers.get(queryClient);
  if (state) return state;

  state = { episodes: new Map(), tracked: new Map() };
  schedulers.set(queryClient, state);

  const scheduler = state;
  // Exactly ONE cache listener per QueryClient, created with this state and never detached:
  // it is WeakMap-scoped, so it is collected together with the client it belongs to.
  queryClient.getQueryCache().subscribe((event) => {
    const hash = event.query.queryHash;
    if (!scheduler.tracked.has(hash) && !scheduler.episodes.has(hash)) return;
    if (event.type === 'removed') {
      discardEpisode(scheduler, hash);
      return;
    }
    evaluate(queryClient, scheduler, hash);
  });

  return state;
}

export interface TrackAbsentDocParams {
  queryClient: QueryClient;
  /** Exact key of the per-id lookup query. */
  queryKey: QueryKey;
  /**
   * Ladder this registrant wants; an empty array means it wants no re-reads. Registrants
   * on the same key combine by union — the longest ladder among them governs — so one
   * consumer passing `[]` never disables polling another consumer asked for.
   */
  delays?: readonly number[];
}

/**
 * Register interest in re-reading `queryKey` while it resolves absent. Returns an
 * idempotent release function; releasing the last interested consumer pauses the ladder
 * without spending the episode's remaining budget, and releasing the last registrant that
 * wanted polling shrinks the effective ladder for the episode still in progress.
 */
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
      // The effective ladder changed: re-derive under the new one rather than letting a
      // timer from the departed registrant's ladder fire.
      clearTimer(state.episodes.get(hash));
      evaluate(queryClient, state, hash);
    }
  };
}

/** Test-only: number of absence episodes currently tracked for a QueryClient. */
export function __absenceEpisodeCount(queryClient: QueryClient): number {
  return schedulers.get(queryClient)?.episodes.size ?? 0;
}

/** Test-only: rungs already spent on a key's current episode, or `null` if there is none. */
export function __absenceAttempt(queryClient: QueryClient, queryKey: QueryKey): number | null {
  return schedulers.get(queryClient)?.episodes.get(hashOf(queryClient, queryKey))?.attempt ?? null;
}
