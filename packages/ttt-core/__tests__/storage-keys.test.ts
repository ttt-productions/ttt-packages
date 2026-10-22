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
  TEXT_SIZE_STORAGE_KEY,
  TEXT_SIZE_CHANGE_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '../src/constants/storage-keys.js';

describe('Company dock storage keys + events are byte-stable', () => {
  it("holds the exact literal values members' browsers already hold", () => {
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
    expect(REDUCED_MOTION_STORAGE_KEY).not.toBe(MASCOT_HIDDEN_STORAGE_KEY);
    expect(REDUCED_MOTION_CHANGE_EVENT).not.toBe(MASCOT_HIDDEN_CHANGE_EVENT);
  });
});

describe('Large-text House control storage key + event (device-local)', () => {
  it('holds the exact literal values the app store already persists', () => {
    // Byte-identical to the values members' browsers already hold — changing either would orphan
    // every member's saved preference.
    expect(TEXT_SIZE_STORAGE_KEY).toBe('ttt-text-size');
    expect(TEXT_SIZE_CHANGE_EVENT).toBe('ttt-text-size-change');
  });

  it('is an independent control — no key or event is shared with a sibling House store', () => {
    const keys = [TEXT_SIZE_STORAGE_KEY, REDUCED_MOTION_STORAGE_KEY, MASCOT_HIDDEN_STORAGE_KEY];
    const events = [
      TEXT_SIZE_CHANGE_EVENT,
      REDUCED_MOTION_CHANGE_EVENT,
      MASCOT_HIDDEN_CHANGE_EVENT,
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(events).size).toBe(events.length);
    expect(TEXT_SIZE_CHANGE_EVENT).not.toBe(TEXT_SIZE_STORAGE_KEY);
  });
});

describe('Cookie/analytics consent storage key (device-local)', () => {
  it('holds the exact literal the app store already persists', () => {
    // Byte-identical to the storage key and cookie name visitors' browsers already hold —
    // changing it would re-prompt every visitor who already made a consent choice.
    expect(COOKIE_CONSENT_STORAGE_KEY).toBe('ttt_cookie_consent');
  });

  it('is an independent device preference — shares no key with a House control', () => {
    const keys = [
      COOKIE_CONSENT_STORAGE_KEY,
      TEXT_SIZE_STORAGE_KEY,
      REDUCED_MOTION_STORAGE_KEY,
      MASCOT_HIDDEN_STORAGE_KEY,
      COMPANION_STORAGE_KEY,
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('theme storage key', () => {
  it('is the next-themes default key, so a theme saved under the unnamed default keeps applying', () => {
    expect(THEME_STORAGE_KEY).toBe('theme');
  });
});
