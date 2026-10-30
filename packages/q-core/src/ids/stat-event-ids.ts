import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';
import type { StatCounterKey } from '../types/sports.js';

export function buildStatEventId(nowMs: number, suffix: string): string {
  return `${nowMs}${COMPOUND_ID_SEPARATOR}${suffix}`;
}

export const MAX_SPORT_STAT_EVENT_ID_LENGTH = 200;

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
