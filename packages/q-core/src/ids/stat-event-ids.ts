// Ids of the stat event store: `sportGames/{gameId}/gameStatEvents/{eventId}` and the pages of a
// completed game's finalized record, `sportGames/{gameId}/gameStatHistory/{pageId}`.
//
// A sport event's id is minted once, at the tap, and every retry of that event reuses it — the id is
// what makes a re-send an acknowledgement rather than a second application (RULE-QS-SPORT-912). The two
// store-level events take ids derived from what they act on, so a target has at most one void and a
// correction operation writes at most one correction per line and field.

import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';
import type { StatCounterKey } from '../types/sports.js';

export function buildStatEventId(nowMs: number, suffix: string): string {
  return `${nowMs}${COMPOUND_ID_SEPARATOR}${suffix}`;
}

// The longest sport event id a scoring write accepts — far past a minted id or a copied one.
export const MAX_SPORT_STAT_EVENT_ID_LENGTH = 200;

/**
 * Whether `id` can be a sport event's id — minted at the tap, or kept by a copied event: it begins
 * with a digit and holds no path separator, so it names one document of the game's event
 * subcollection and never a void's or a correction's id. A scoring write accepts no other id from
 * its caller, because the id becomes a document path (RULE-STD-ARCH-106).
 */
export function isSportStatEventId(id: string): boolean {
  return id.length <= MAX_SPORT_STAT_EVENT_ID_LENGTH && /^[0-9]/.test(id) && !id.includes('/');
}

// Minted event ids — and the ids copied events keep — begin with a digit, so these prefixes never
// meet one.
const STAT_VOID_ID_PREFIX = 'void';
const STAT_CORRECTION_ID_PREFIX = 'correction';

export function buildStatVoidId(targetEventId: string): string {
  return [STAT_VOID_ID_PREFIX, targetEventId].join(COMPOUND_ID_SEPARATOR);
}

// `lineKey` is the roster-entry id of a player line, or the team id of a team line.
export function buildStatCorrectionId(
  operationId: string,
  lineKey: string,
  field: StatCounterKey,
): string {
  return [STAT_CORRECTION_ID_PREFIX, operationId, lineKey, field].join(COMPOUND_ID_SEPARATOR);
}

// Zero-padded so the pages of one record sort in page order by id.
const STAT_HISTORY_PAGE_INDEX_WIDTH = 4;

export function buildStatHistoryPageId(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError(`A finalized-record page index is a whole number from 0, not ${index}.`);
  }
  return `page${COMPOUND_ID_SEPARATOR}${String(index).padStart(STAT_HISTORY_PAGE_INDEX_WIDTH, '0')}`;
}
