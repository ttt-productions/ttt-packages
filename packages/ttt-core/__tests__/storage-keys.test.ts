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
