// The site-tour PENDING preference — the device-local slot behind the ONE sanctioned
// optimistic-hide exception. `privateData/{uid}.siteTour` stays the sole authority; this
// entry only overlays it while a callable write is unconfirmed.
//
// Every case here maps to a failure the shape exists to prevent: a choice leaking across
// accounts, malformed storage hiding the tour forever, an old completion completing a NEW
// tour, and a slow tab erasing a newer tab's choice (the compare-and-remove `id`).

import { describe, it, expect } from 'vitest';
import {
  SiteTourPendingPreferenceSchema,
  UpdateSiteTourPreferenceInputSchema,
  type SiteTourPendingPreference,
} from '../src/schemas/users';
import {
  siteTourPendingStorageKey,
  SITE_TOUR_PENDING_CHANGE_EVENT,
  TEXT_SIZE_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  MASCOT_HIDDEN_STORAGE_KEY,
  TEXT_SIZE_CHANGE_EVENT,
  REDUCED_MOTION_CHANGE_EVENT,
  MASCOT_HIDDEN_CHANGE_EVENT,
} from '../src/constants/storage-keys';
import { SITE_TOUR_CURRENT_VERSION } from '../src/constants/business-user';

const envelope = {
  schemaVersion: 1 as const,
  id: 'pending-1',
  uid: 'user-1',
  createdAt: 1_700_000_000_000,
};

describe('siteTourPendingStorageKey', () => {
  it('is UID-SCOPED — two accounts on one device never share a slot', () => {
    expect(siteTourPendingStorageKey('user-1')).not.toBe(siteTourPendingStorageKey('user-2'));
  });

  it('is deterministic and carries the ttt- key prefix its sibling keys use', () => {
    expect(siteTourPendingStorageKey('user-1')).toBe(siteTourPendingStorageKey('user-1'));
    expect(siteTourPendingStorageKey('user-1').startsWith('ttt-')).toBe(true);
    expect(siteTourPendingStorageKey('user-1')).toContain('user-1');
  });

  it('collides with no sibling House-control key, and the change event is its own string', () => {
    const siblings = [TEXT_SIZE_STORAGE_KEY, REDUCED_MOTION_STORAGE_KEY, MASCOT_HIDDEN_STORAGE_KEY];
    expect(siblings).not.toContain(siteTourPendingStorageKey('user-1'));
    const events = [
      SITE_TOUR_PENDING_CHANGE_EVENT,
      TEXT_SIZE_CHANGE_EVENT,
      REDUCED_MOTION_CHANGE_EVENT,
      MASCOT_HIDDEN_CHANGE_EVENT,
    ];
    expect(new Set(events).size).toBe(events.length);
    // A shared value would make the same-tab broadcast collide with the storage key itself.
    expect(SITE_TOUR_PENDING_CHANGE_EVENT).not.toBe(siteTourPendingStorageKey('user-1'));
  });
});

describe('SiteTourPendingPreferenceSchema — valid entries', () => {
  it('accepts deferToday with a strict YYYY-MM-DD local date', () => {
    const parsed = SiteTourPendingPreferenceSchema.parse({
      ...envelope,
      action: 'deferToday',
      date: '2026-08-02',
    });
    expect(parsed).toMatchObject({ action: 'deferToday', date: '2026-08-02', uid: 'user-1' });
  });

  it('accepts payload-free dismissAutomaticInvites', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'dismissAutomaticInvites' })
        .success,
    ).toBe(true);
  });

  it('accepts completeTour carrying the observed tour version', () => {
    const parsed = SiteTourPendingPreferenceSchema.parse({
      ...envelope,
      action: 'completeTour',
      tourVersion: SITE_TOUR_CURRENT_VERSION,
    });
    expect(parsed).toMatchObject({ action: 'completeTour', tourVersion: SITE_TOUR_CURRENT_VERSION });
  });

  it('surfaces the compare-and-remove id and the owner uid on every variant', () => {
    const entries: SiteTourPendingPreference[] = [
      SiteTourPendingPreferenceSchema.parse({ ...envelope, action: 'deferToday', date: '2026-08-02' }),
      SiteTourPendingPreferenceSchema.parse({ ...envelope, action: 'dismissAutomaticInvites' }),
      SiteTourPendingPreferenceSchema.parse({ ...envelope, action: 'completeTour', tourVersion: 1 }),
    ];
    for (const entry of entries) {
      expect(entry.id).toBe('pending-1');
      expect(entry.uid).toBe('user-1');
      expect(entry.schemaVersion).toBe(1);
    }
  });
});

describe('SiteTourPendingPreferenceSchema — rejected entries fall back to the server', () => {
  it('rejects an unknown action', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'skipForever' }).success,
    ).toBe(false);
  });

  it('rejects a missing action entirely', () => {
    expect(SiteTourPendingPreferenceSchema.safeParse({ ...envelope }).success).toBe(false);
  });

  it('rejects a wrong or missing schemaVersion (a future shape must not parse as v1)', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        schemaVersion: 2,
        action: 'dismissAutomaticInvites',
      }).success,
    ).toBe(false);
    const { schemaVersion: _omitted, ...noVersion } = envelope;
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...noVersion, action: 'dismissAutomaticInvites' })
        .success,
    ).toBe(false);
  });

  it('rejects a missing id — without it compare-and-remove cannot protect a newer choice', () => {
    const { id: _omitted, ...noId } = envelope;
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...noId, action: 'dismissAutomaticInvites' })
        .success,
    ).toBe(false);
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        id: '',
        action: 'dismissAutomaticInvites',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing or empty uid — the entry must prove which account made the choice', () => {
    const { uid: _omitted, ...noUid } = envelope;
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...noUid, action: 'dismissAutomaticInvites' })
        .success,
    ).toBe(false);
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        uid: '',
        action: 'dismissAutomaticInvites',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing or non-numeric createdAt', () => {
    const { createdAt: _omitted, ...noCreatedAt } = envelope;
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...noCreatedAt,
        action: 'dismissAutomaticInvites',
      }).success,
    ).toBe(false);
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        createdAt: '2026-08-02',
        action: 'dismissAutomaticInvites',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed deferToday date (same strict YYYY-MM-DD rule as the callable)', () => {
    for (const date of ['2026-8-2', '08/02/2026', '2026-08-02T00:00:00Z', 20260802, '']) {
      expect(
        SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'deferToday', date })
          .success,
      ).toBe(false);
    }
  });

  it('rejects deferToday with no date at all', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'deferToday' }).success,
    ).toBe(false);
  });

  it('rejects completeTour without a tourVersion, or with a non-positive/fractional one', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'completeTour' }).success,
    ).toBe(false);
    for (const tourVersion of [0, -1, 1.5, '1']) {
      expect(
        SiteTourPendingPreferenceSchema.safeParse({ ...envelope, action: 'completeTour', tourVersion })
          .success,
      ).toBe(false);
    }
  });

  it('is STRICT — a stray key is rejected, never silently dropped', () => {
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        action: 'dismissAutomaticInvites',
        date: '2026-08-02',
      }).success,
    ).toBe(false);
    expect(
      SiteTourPendingPreferenceSchema.safeParse({
        ...envelope,
        action: 'completeTour',
        tourVersion: 1,
        bogus: 'x',
      }).success,
    ).toBe(false);
  });

  it('rejects the malformed JSON shapes storage realistically yields', () => {
    for (const raw of [null, 'deferToday', 42, [], { action: 'deferToday' }]) {
      expect(SiteTourPendingPreferenceSchema.safeParse(raw).success).toBe(false);
    }
  });
});

describe('the pending entry is a replay guard, never server authority', () => {
  it('carries a tourVersion the CALLABLE payload deliberately does not accept', () => {
    // The server stamps SITE_TOUR_CURRENT_VERSION at completion; the local version exists
    // only so a stale pending completion can be discarded instead of completing a NEW tour.
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'completeTour', tourVersion: 1 })
        .success,
    ).toBe(false);
    expect(UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'completeTour' }).success).toBe(
      true,
    );
  });

  it('models the stale-completion decision: a stored version != current is discardable', () => {
    const stale = SiteTourPendingPreferenceSchema.parse({
      ...envelope,
      action: 'completeTour',
      tourVersion: SITE_TOUR_CURRENT_VERSION + 1,
    });
    expect(stale.action === 'completeTour' && stale.tourVersion === SITE_TOUR_CURRENT_VERSION).toBe(
      false,
    );
  });

  it('accepts exactly the three actions the server writer accepts — no fourth local-only action', () => {
    const actions = ['deferToday', 'dismissAutomaticInvites', 'completeTour'] as const;
    for (const action of actions) {
      expect(UpdateSiteTourPreferenceInputSchema.options.some((o) => o.shape.action.value === action)).toBe(
        true,
      );
      expect(SiteTourPendingPreferenceSchema.options.some((o) => o.shape.action.value === action)).toBe(
        true,
      );
    }
    expect(SiteTourPendingPreferenceSchema.options).toHaveLength(actions.length);
  });
});
