// Phase 1A proof: the Center Stage rooms migrated to ttt-core as pure data with
// unique, complete keys and verbatim copy.

import { describe, it, expect } from 'vitest';
import {
  CENTER_STAGE_ROOMS,
  type CenterStageRoomKey,
} from '../src/constants/center-stage-rooms';

const EXPECTED_KEYS: readonly CenterStageRoomKey[] = ['hall', 'square', 'audition'];

describe('CENTER_STAGE_ROOMS', () => {
  it('has exactly the three rooms in revolve order (Hall opens the spotlight)', () => {
    expect(CENTER_STAGE_ROOMS.map((r) => r.key)).toEqual(EXPECTED_KEYS);
  });

  it('room keys are unique', () => {
    const keys = CENTER_STAGE_ROOMS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every room carries name, verb, href, and description', () => {
    for (const room of CENTER_STAGE_ROOMS) {
      expect(typeof room.name).toBe('string');
      expect(room.name.length).toBeGreaterThan(0);
      expect(typeof room.verb).toBe('string');
      expect(room.verb.length).toBeGreaterThan(0);
      expect(room.href.startsWith('/')).toBe(true);
      expect(typeof room.description).toBe('string');
      expect(room.description.length).toBeGreaterThan(0);
    }
  });

  it('maps each room to its verbatim route + copy', () => {
    const byKey = Object.fromEntries(CENTER_STAGE_ROOMS.map((r) => [r.key, r]));
    expect(byKey.hall).toMatchObject({ name: 'The Hall', verb: 'Watch, read & listen', href: '/hall-library' });
    expect(byKey.square).toMatchObject({ name: 'The Square', verb: "See what's happening", href: '/square-streetz' });
    expect(byKey.audition).toMatchObject({
      name: 'The Audition Stage',
      verb: 'Cast your vote',
      href: '/audition-board',
    });
  });

  it('is pure JSON-serializable data', () => {
    expect(() => JSON.stringify(CENTER_STAGE_ROOMS)).not.toThrow();
  });
});
