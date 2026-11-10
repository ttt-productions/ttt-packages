import { describe, expect, it } from 'vitest';
import { INITIAL_BEACON_OBSERVATION, observeBeacon } from '../src/beacon-observation.js';
import type { BeaconObservation, BeaconSnapshot } from '../src/beacon-observation.js';

const live = (changeId: string | null, reportFirstLoad = false): BeaconSnapshot => ({
  live: true,
  exists: changeId !== null,
  changeId,
  reportFirstLoad,
});
const notLive = (changeId: string | null): BeaconSnapshot => ({
  live: false,
  exists: changeId !== null,
  changeId,
  reportFirstLoad: false,
});
const storedWithoutId: BeaconSnapshot = {
  live: true,
  exists: true,
  changeId: null,
  reportFirstLoad: false,
};

function run(snapshots: BeaconSnapshot[], start: BeaconObservation = INITIAL_BEACON_OBSERVATION) {
  let state = start;
  return snapshots.map((snapshot) => {
    const decision = observeBeacon(state, snapshot);
    state = decision.next;
    return decision.report;
  });
}

describe('the beacon decision', () => {
  it('takes the first live snapshot as the baseline when a first load reports nothing', () => {
    expect(run([live('a')])).toEqual([false]);
  });

  it('reports on the first live snapshot when the app asks for a first load to report', () => {
    expect(run([live('a', true)])).toEqual([true]);
    expect(run([live(null, true)])).toEqual([true]);
  });

  it('asks about a first load once, never on a later snapshot of the same id', () => {
    expect(run([live('a', true), live('a', true)])).toEqual([true, false]);
  });

  it('reports on every new change id seen live, and never on the same id again', () => {
    expect(run([live('a'), live('a'), live('b'), live('b'), live('c')])).toEqual([
      false,
      false,
      true,
      false,
      true,
    ]);
  });

  it('reports on a change id that is not the last one seen, since every new id is a new commit', () => {
    expect(run([live('b'), live('a')])).toEqual([false, true]);
  });

  it('never takes a snapshot that is not live as seen, so the server confirming it still reports', () => {
    expect(run([live('a'), notLive('c'), live('c')])).toEqual([false, false, true]);
  });

  it('reports on reconnect when the beacon moved while the listener was away', () => {
    expect(run([live('a'), notLive('a'), notLive('a'), live('d')])).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it('does not report on reconnect when nothing moved while the listener was away', () => {
    expect(run([live('a'), notLive('a'), live('a')])).toEqual([false, false, false]);
  });

  it('catches up after a listener that held no answer recovers', () => {
    expect(run([live('a'), notLive(null), live('e')])).toEqual([false, false, true]);
  });

  it('never takes a snapshot before the first live one as the baseline', () => {
    expect(run([notLive('a'), live('a')])).toEqual([false, false]);
    expect(run([notLive('a'), live('a', true)])).toEqual([false, true]);
  });

  it('reports when the first beacon appears where there was none', () => {
    expect(run([live(null), live('a')])).toEqual([false, true]);
  });

  it('keeps the last id seen while the document is missing, so the same id coming back reports nothing', () => {
    expect(run([live('a'), live(null), live('a')])).toEqual([false, false, false]);
    expect(run([live('a'), live(null), live('b')])).toEqual([false, false, true]);
  });

  it('reports when the first write with an id replaces a beacon stored without one', () => {
    expect(run([storedWithoutId, storedWithoutId, live('a')])).toEqual([false, false, true]);
  });
});
