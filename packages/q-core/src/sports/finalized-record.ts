// A completed game's finalized record, `sportGames/{gameId}/gameStatHistory/{pageId}`: every event
// document of the game in `sequence` order, in pages of up to STAT_HISTORY_PAGE_SIZE, the first page
// carrying the sport, the teams, and the participation snapshot finalize applied. These are the one
// builder and the one reader of its pages, so finalize, the game copy, a ghost link, and the week
// view all write and read the same record.

import { STAT_HISTORY_PAGE_SIZE } from '../constants/sports.js';
import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStatHistoryFirstPage, GameStatHistoryPage } from '../doc-schemas/game-stat-history.js';
import { buildStatHistoryPageId } from '../ids/stat-event-ids.js';
import type { FinalizedGame } from './contribution.js';
import { replayGameStats } from './replay.js';
import type { AnySportAdapter } from './sport-adapter.js';

/** What a record holds beside its events: the sport, the teams, and the participation snapshot. */
export type FinalizedRecordSnapshot = Omit<GameStatHistoryFirstPage, 'events' | 'pageCount'>;

/** One page as written, at its id. */
export interface FinalizedRecordPage {
  readonly pageId: string;
  readonly page: GameStatHistoryPage;
}

/**
 * The record's pages: the events in `sequence` order, cut into pages, the first carrying the page
 * count and the snapshot. A game with no events still has its first page.
 */
export function buildFinalizedRecordPages(
  events: readonly GameStatEvent[],
  snapshot: Pick<
    FinalizedGame,
    'leagueType' | 'teamIds' | 'rosterPlayerIds' | 'absentRosterPlayerIds' | 'nonScoringRosterPlayerIds'
  >,
): FinalizedRecordPage[] {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const pageCount = Math.max(1, Math.ceil(ordered.length / STAT_HISTORY_PAGE_SIZE));
  const pages: FinalizedRecordPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const slice = ordered.slice(index * STAT_HISTORY_PAGE_SIZE, (index + 1) * STAT_HISTORY_PAGE_SIZE);
    const page: GameStatHistoryPage =
      index === 0
        ? {
            events: slice,
            pageCount,
            leagueType: snapshot.leagueType,
            teamIds: [...snapshot.teamIds],
            rosterPlayerIds: [...snapshot.rosterPlayerIds],
            absentRosterPlayerIds: [...snapshot.absentRosterPlayerIds],
            nonScoringRosterPlayerIds: [...snapshot.nonScoringRosterPlayerIds],
          }
        : { events: slice };
    pages.push({ pageId: buildStatHistoryPageId(index), page });
  }
  return pages;
}

/** Whether a page is a record's first page, which carries the snapshot. */
export function isFirstRecordPage(page: GameStatHistoryPage): page is GameStatHistoryFirstPage {
  return 'pageCount' in page;
}

/**
 * The record read back: the first page's snapshot and every event, in order. Throws when the pages
 * are not one whole record — no first page, a page count they do not match, or events out of order —
 * which is damage to a completed game, never a designed answer.
 */
export function readFinalizedRecord(pages: readonly GameStatHistoryPage[]): {
  readonly snapshot: FinalizedRecordSnapshot;
  readonly events: GameStatEvent[];
} {
  const [first, ...rest] = pages;
  if (first === undefined || !isFirstRecordPage(first)) throw new Error('A finalized record starts with its first page.');
  if (first.pageCount !== pages.length) {
    throw new Error(`A finalized record of ${first.pageCount} pages was read as ${pages.length}.`);
  }
  const events = [...first.events, ...rest.flatMap((page) => page.events)];
  events.forEach((event, index) => {
    if (index > 0 && (events[index - 1] as GameStatEvent).sequence >= event.sequence) {
      throw new Error(`A finalized record holds event ${event.eventId} out of sequence.`);
    }
  });
  const snapshot: FinalizedRecordSnapshot = {
    leagueType: first.leagueType,
    teamIds: first.teamIds,
    rosterPlayerIds: first.rosterPlayerIds,
    absentRosterPlayerIds: first.absentRosterPlayerIds,
    nonScoringRosterPlayerIds: first.nonScoringRosterPlayerIds,
  };
  return { snapshot, events };
}

/**
 * The completed game a record describes: its events replayed through the sport's adapter, with the
 * snapshot finalize stored. Every path after finalize derives a game's contribution from this, never
 * from the game document.
 */
export function finalizedGameFromRecord(adapter: AnySportAdapter, pages: readonly GameStatHistoryPage[]): FinalizedGame {
  const { snapshot, events } = readFinalizedRecord(pages);
  return {
    leagueType: snapshot.leagueType,
    teamIds: snapshot.teamIds,
    stats: replayGameStats(adapter, snapshot, events),
    rosterPlayerIds: snapshot.rosterPlayerIds,
    absentRosterPlayerIds: snapshot.absentRosterPlayerIds,
    nonScoringRosterPlayerIds: snapshot.nonScoringRosterPlayerIds,
  };
}
