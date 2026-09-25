import { describe, it, expect } from 'vitest';
import {
  advanceBaseline,
  beginSave,
  changedAccountSettings,
  compareViewerSettings,
  dismissalOf,
  holdingDismissals,
  isDismissed,
  parseDismissals,
  releaseLandedSaves,
  savingSettings,
  serializeDismissals,
  settleSave,
  viewerSettingsFromDifferences,
  type Dismissal,
} from '../src/viewer-settings-logic';
import type { SavedViewerSettings, ViewerSettingDifference, ViewerSettingName } from '../src/viewer-settings';

const NOTHING: SavedViewerSettings = { theme: null, reducedMotion: null };
const NONE: ReadonlySet<ViewerSettingName> = new Set();

// A device compared at the moment the account's values arrived, with no save in flight.
function compareAtLoad(device: SavedViewerSettings, account: SavedViewerSettings) {
  return compareViewerSettings({ device, account, deviceAtAccountChange: device, saving: NONE });
}

describe('compareViewerSettings', () => {
  it('takes the account\'s values for every setting the device has nothing saved for', () => {
    const result = compareAtLoad(NOTHING, { theme: 'dark', reducedMotion: true });
    expect(result).toEqual({
      adoptFromAccount: { theme: 'dark', reducedMotion: true },
      saveToAccount: {},
      differences: [],
    });
  });

  it('saves the device\'s values for every setting the account has nothing saved for', () => {
    const result = compareAtLoad({ theme: 'light', reducedMotion: false }, NOTHING);
    expect(result.saveToAccount).toEqual({ theme: 'light', reducedMotion: false });
    expect(result.adoptFromAccount).toEqual({});
  });

  it('reports every setting saved on both sides with different values, a saved "full motion" included', () => {
    const result = compareAtLoad({ theme: 'light', reducedMotion: false }, { theme: 'dark', reducedMotion: true });
    expect(result.differences).toEqual([
      { setting: 'theme', device: 'light', account: 'dark' },
      { setting: 'reducedMotion', device: false, account: true },
    ]);
  });

  it('handles each setting on its own', () => {
    const result = compareAtLoad({ theme: null, reducedMotion: true }, { theme: 'dark', reducedMotion: null });
    expect(result.adoptFromAccount).toEqual({ theme: 'dark' });
    expect(result.saveToAccount).toEqual({ reducedMotion: true });
    expect(result.differences).toEqual([]);
  });

  it('asks nothing when the two sides agree', () => {
    const same: SavedViewerSettings = { theme: 'high-contrast', reducedMotion: false };
    expect(compareAtLoad(same, same)).toEqual({ adoptFromAccount: {}, saveToAccount: {}, differences: [] });
  });

  it('leaves out a setting the device changed after its account value arrived', () => {
    const result = compareViewerSettings({
      device: { theme: 'dark', reducedMotion: null },
      account: { theme: 'light', reducedMotion: null },
      deviceAtAccountChange: { theme: 'light', reducedMotion: null },
      saving: NONE,
    });
    expect(result.differences).toEqual([]);
  });

  it('leaves out a setting a save from this tab still answers for', () => {
    const device: SavedViewerSettings = { theme: 'dark', reducedMotion: true };
    const result = compareViewerSettings({
      device,
      account: { theme: 'light', reducedMotion: null },
      deviceAtAccountChange: device,
      saving: new Set<ViewerSettingName>(['theme', 'reducedMotion']),
    });
    expect(result).toEqual({ adoptFromAccount: {}, saveToAccount: {}, differences: [] });
  });
});

describe('advanceBaseline', () => {
  const device: SavedViewerSettings = { theme: 'dark', reducedMotion: true };

  it('records every setting on the first account values', () => {
    const account: SavedViewerSettings = { theme: 'light', reducedMotion: false };
    expect(advanceBaseline(null, account, device)).toEqual({ account, device });
    expect(changedAccountSettings(null, account)).toEqual(['theme', 'reducedMotion']);
  });

  it('returns the same baseline while no account value changes', () => {
    const baseline = advanceBaseline(null, NOTHING, device);
    expect(advanceBaseline(baseline, { ...NOTHING }, { theme: 'light', reducedMotion: false })).toBe(baseline);
  });

  it('moves only the settings whose account value changed', () => {
    const baseline = advanceBaseline(null, { theme: 'light', reducedMotion: false }, { theme: 'light', reducedMotion: false });
    const next = advanceBaseline(baseline, { theme: 'dark', reducedMotion: false }, { theme: 'dark', reducedMotion: true });
    expect(next).toEqual({
      account: { theme: 'dark', reducedMotion: false },
      device: { theme: 'dark', reducedMotion: false },
    });
  });
});

describe('save tracking', () => {
  const account: SavedViewerSettings = { theme: 'light', reducedMotion: false };

  it('answers for a setting while its save is pending', () => {
    const tracks = beginSave({}, { theme: 'dark' }, 1);
    expect([...savingSettings(tracks, account)]).toEqual(['theme']);
  });

  it('drops a failed save', () => {
    const tracks = settleSave(beginSave({}, { theme: 'dark' }, 1), { theme: 'dark' }, 1, false);
    expect(tracks).toEqual({});
  });

  it('answers for a landed save until the account shows its value', () => {
    const landed = settleSave(beginSave({}, { theme: 'dark' }, 1), { theme: 'dark' }, 1, true);
    expect([...savingSettings(landed, account)]).toEqual(['theme']);
    expect([...savingSettings(landed, { ...account, theme: 'dark' })]).toEqual([]);
  });

  it('leaves a later save of the same setting alone when an earlier one settles', () => {
    const tracks = beginSave(beginSave({}, { theme: 'dark' }, 1), { theme: 'high-contrast' }, 2);
    const settled = settleSave(tracks, { theme: 'dark' }, 1, false);
    expect(settled.theme).toEqual({ id: 2, value: 'high-contrast', landed: false });
  });

  it('releases landed saves of settings whose account value changed, never pending ones', () => {
    const landed = settleSave(beginSave({}, { theme: 'dark' }, 1), { theme: 'dark' }, 1, true);
    const tracks = beginSave(landed, { reducedMotion: true }, 2);
    expect(releaseLandedSaves(tracks, ['theme', 'reducedMotion'])).toEqual({
      reducedMotion: { id: 2, value: true, landed: false },
    });
  });
});

describe('viewerSettingsFromDifferences', () => {
  const differences: ViewerSettingDifference[] = [
    { setting: 'theme', device: 'light', account: 'dark' },
    { setting: 'reducedMotion', device: false, account: true },
  ];

  it('reads either side', () => {
    expect(viewerSettingsFromDifferences(differences, 'device')).toEqual({ theme: 'light', reducedMotion: false });
    expect(viewerSettingsFromDifferences(differences, 'account')).toEqual({ theme: 'dark', reducedMotion: true });
  });
});

describe('dismissals', () => {
  const themeDiff: ViewerSettingDifference = { setting: 'theme', device: 'light', account: 'dark' };
  const motionDiff: ViewerSettingDifference = { setting: 'reducedMotion', device: false, account: true };

  it('round-trips through storage, and reads anything unreadable as none', () => {
    const dismissals: Dismissal[] = [dismissalOf(themeDiff), dismissalOf(motionDiff)];
    expect(parseDismissals(serializeDismissals(dismissals))).toEqual(dismissals);
    expect(serializeDismissals([])).toBeNull();
    for (const stored of [null, 'not json', '{}', '[["colour", 1, 2]]']) expect(parseDismissals(stored)).toEqual([]);
  });

  it('matches each difference on its own, by setting and both values', () => {
    const dismissals = [dismissalOf(themeDiff)];
    expect(isDismissed(themeDiff, dismissals)).toBe(true);
    expect(isDismissed(motionDiff, dismissals)).toBe(false);
    expect(isDismissed({ ...themeDiff, account: 'high-contrast' }, dismissals)).toBe(false);
  });

  it('keeps only the dismissals whose values the device and account still carry', () => {
    const dismissals = [dismissalOf(themeDiff), dismissalOf(motionDiff)];
    expect(holdingDismissals(dismissals, { theme: 'dark', reducedMotion: false }, { theme: 'dark', reducedMotion: true })).toEqual([
      dismissalOf(motionDiff),
    ]);
  });
});
