import { describe, it, expect } from 'vitest';
import { buildGameRosterPlayerId, parseGameRosterPlayerId } from '../src/ids/compound-ids';
import { buildGhostUserId } from '../src/ids/minted-ids';
import {
  buildStatCorrectionId,
  buildStatEventId,
  buildStatHistoryPageId,
  buildStatVoidId,
} from '../src/ids/stat-event-ids';

const TEAM = 'aB3dE5gH7jK9mN1pQ3sT';
const UID = 'aB3dE5gH7jK9mN1pQ3sT5vW7xY9z';
const GHOST = buildGhostUserId(1712345678901, 'ab12cd3');

describe('game roster entry ids', () => {
  it('is the team and the person, so one person on both teams of a game has two entries', () => {
    expect(buildGameRosterPlayerId(TEAM, UID)).toBe(`${TEAM}_${UID}`);
    expect(buildGameRosterPlayerId('T1', UID)).not.toBe(buildGameRosterPlayerId('T2', UID));
  });

  it('round-trips a real user id and a ghost id, whose own underscores stay in the userId part', () => {
    expect(parseGameRosterPlayerId(buildGameRosterPlayerId(TEAM, UID))).toEqual({ teamId: TEAM, userId: UID });
    expect(parseGameRosterPlayerId(buildGameRosterPlayerId(TEAM, GHOST))).toEqual({ teamId: TEAM, userId: GHOST });
  });

  it('parses nothing from an id that is not a roster entry', () => {
    expect(parseGameRosterPlayerId(UID)).toBeNull();
    expect(parseGameRosterPlayerId('')).toBeNull();
    expect(parseGameRosterPlayerId(`${TEAM}_`)).toBeNull();
    expect(parseGameRosterPlayerId(`_${UID}`)).toBeNull();
  });
});

describe('stat event ids', () => {
  it('mints a sport event id from the tap time and a random suffix', () => {
    expect(buildStatEventId(1712345678901, 'k3j9x2')).toBe('1712345678901_k3j9x2');
  });

  it('derives one void id per target, so a second undo of an event is the same document', () => {
    const target = buildStatEventId(1712345678901, 'k3j9x2');
    expect(buildStatVoidId(target)).toBe(buildStatVoidId(target));
    expect(buildStatVoidId(target)).not.toBe(buildStatVoidId(buildStatEventId(1712345678901, 'k3j9x3')));
  });

  it('never gives a void or a correction the id of a sport event', () => {
    const target = buildStatEventId(1712345678901, 'k3j9x2');
    expect(buildStatVoidId(target)).not.toMatch(/^\d/);
    expect(buildStatCorrectionId('migration', TEAM, 'score')).not.toMatch(/^\d/);
    expect(buildStatVoidId(target)).not.toBe(target);
  });

  it('derives one correction id per operation, line, and field', () => {
    const playerLine = buildGameRosterPlayerId(TEAM, UID);
    const id = buildStatCorrectionId('migration', playerLine, 'points');
    expect(id).toBe(buildStatCorrectionId('migration', playerLine, 'points'));
    expect(id).not.toBe(buildStatCorrectionId('migration', playerLine, 'rebounds'));
    expect(id).not.toBe(buildStatCorrectionId('op-2', playerLine, 'points'));
    expect(id).not.toBe(buildStatCorrectionId('migration', TEAM, 'points'));
  });
});

describe('finalized-record page ids', () => {
  it('numbers the pages from zero, padded so they sort in page order', () => {
    expect(buildStatHistoryPageId(0)).toBe('page_0000');
    expect(buildStatHistoryPageId(12)).toBe('page_0012');
    const ids = [10, 2, 0, 1].map(buildStatHistoryPageId);
    expect([...ids].sort()).toEqual([0, 1, 2, 10].map(buildStatHistoryPageId));
  });

  it('refuses an index that is not a whole number from zero', () => {
    expect(() => buildStatHistoryPageId(-1)).toThrow(RangeError);
    expect(() => buildStatHistoryPageId(1.5)).toThrow(RangeError);
    expect(() => buildStatHistoryPageId(Number.NaN)).toThrow(RangeError);
  });
});
