// The Company dock stores + same-tab events are device-local and MUST keep their
// byte-stable historical values (the 'bill' naming predates the Company rename).

import { describe, it, expect } from 'vitest';
import {
  COMPANION_STORAGE_KEY,
  MASCOT_HIDDEN_STORAGE_KEY,
  MASCOT_LINE_INDEX_STORAGE_KEY,
  MASCOT_HIDDEN_CHANGE_EVENT,
  COMPANION_CHANGE_EVENT,
  MASCOT_POSE_CHANGE_EVENT,
  REDUCED_MOTION_STORAGE_KEY,
  REDUCED_MOTION_CHANGE_EVENT,
} from '../src/constants/storage-keys';

describe('Company dock storage keys + events are byte-stable', () => {
  it('holds the exact historical literal values', () => {
    expect(COMPANION_STORAGE_KEY).toBe('ttt-company-companion');
    expect(MASCOT_HIDDEN_STORAGE_KEY).toBe('ttt-bill-hidden');
    expect(MASCOT_LINE_INDEX_STORAGE_KEY).toBe('ttt-bill-line-index');
    expect(MASCOT_HIDDEN_CHANGE_EVENT).toBe('ttt-bill-pref-change');
    expect(COMPANION_CHANGE_EVENT).toBe('ttt-company-companion-change');
    expect(MASCOT_POSE_CHANGE_EVENT).toBe('ttt-bill-pose-change');
  });
});

describe('Manual reduced-motion House control storage key + event (device-local)', () => {
  it('holds the exact literal values and is distinct from the companion store', () => {
    expect(REDUCED_MOTION_STORAGE_KEY).toBe('ttt-reduced-motion');
    expect(REDUCED_MOTION_CHANGE_EVENT).toBe('ttt-reduced-motion-change');
    // Independent control: must not reuse the companion visibility key/event.
    expect(REDUCED_MOTION_STORAGE_KEY).not.toBe(MASCOT_HIDDEN_STORAGE_KEY);
    expect(REDUCED_MOTION_CHANGE_EVENT).not.toBe(MASCOT_HIDDEN_CHANGE_EVENT);
  });
});
