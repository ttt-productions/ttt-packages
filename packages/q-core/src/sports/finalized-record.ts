import { MAX_STAT_HISTORY_PAGES, STAT_HISTORY_PAGE_SIZE } from '../constants/sports.js';
import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type {
  GameStatHistoryFirstPage,
  GameStatHistoryPage,
} from '../doc-schemas/game-stat-history.js';
import { buildStatHistoryPageId } from '../ids/stat-event-ids.js';
import type { FinalizedGame } from './contribution.js';
import { replayGameStats } from './replay.js';
import type { AnySportAdapter } from './sport-adapter.js';

export type FinalizedRecordSnapshot = Omit<GameStatHistoryFirstPage, 'events' | 'pageCount'>;

export interface FinalizedRecordPage {
  readonly pageId: string;
  readonly page: GameStatHistoryPage;
}

export function buildFinalizedRecordPages(
  events: readonly GameStatEvent[],
  snapshot: Pick<
    FinalizedGame,
    | 'leagueType'
    | 'teamIds'
    | 'rosterPlayerIds'
    | 'absentRosterPlayerIds'
    | 'nonScoringRosterPlayerIds'
  >,
): FinalizedRecordPage[] {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const pageCount = Math.max(1, Math.ceil(ordered.length / STAT_HISTORY_PAGE_SIZE));
  if (pageCount > MAX_STAT_HISTORY_PAGES) {
    throw new RangeError(
      `A finalized record holds at most ${MAX_STAT_HISTORY_PAGES} pages; ${ordered.length} events need ${pageCount}.`,
    );
  }
  const pages: FinalizedRecordPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const slice = ordered.slice(
      index * STAT_HISTORY_PAGE_SIZE,
      (index + 1) * STAT_HISTORY_PAGE_SIZE,
    );
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

export function isFirstRecordPage(page: GameStatHistoryPage): page is GameStatHistoryFirstPage {
  return 'pageCount' in page;
}

// The pages as the record's collection lists them, in id order. They are one whole record only as
// the exact set: the first page at `page_0000`, then a continuation page at each next id, as many in
// all as the first page counts.
export function readFinalizedRecord(pages: readonly FinalizedRecordPage[]): {
  readonly snapshot: FinalizedRecordSnapshot;
  readonly events: GameStatEvent[];
} {
  if (pages.length > MAX_STAT_HISTORY_PAGES) {
    throw new Error(`A finalized record holds at most ${MAX_STAT_HISTORY_PAGES} pages.`);
  }
  const [firstEntry, ...restEntries] = pages;
  const first = firstEntry?.page;
  if (first === undefined || !isFirstRecordPage(first))
    throw new Error('A finalized record starts with its first page.');
  if (first.pageCount !== pages.length) {
    throw new Error(`A finalized record of ${first.pageCount} pages was read as ${pages.length}.`);
  }
  pages.forEach(({ pageId, page }, index) => {
    if (pageId !== buildStatHistoryPageId(index)) {
      throw new Error(`A finalized record holds page ${pageId} at position ${index}.`);
    }
    if (index > 0 && isFirstRecordPage(page)) {
      throw new Error(`A finalized record holds a second first page at ${pageId}.`);
    }
  });
  const rest = restEntries.map(({ page }) => page);
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

export function finalizedGameFromRecord(
  adapter: AnySportAdapter,
  pages: readonly FinalizedRecordPage[],
): FinalizedGame {
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
