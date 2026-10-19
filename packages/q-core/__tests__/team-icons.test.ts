// The team icon set: a stored team's icon is one of `TEAM_ICON_KEYS`, so the set only grows — every
// key a team may already hold stays, in its place.

import { describe, expect, it } from 'vitest';
import { TEAM_ICON_KEYS } from '../src/types/unions.js';
import { teamIconSchema } from '../src/doc-schemas/atoms.js';

// The set as first shipped. A team document may hold any of these, so none is renamed or removed.
const FIRST_ICON_KEYS = [
  'Shield', 'Swords', 'Skull', 'Ghost', 'Cat', 'Dog', 'Bird', 'Fish', 'Rabbit', 'Snail', 'Turtle',
  'Cherry', 'Apple', 'Grape', 'Rocket', 'Plane', 'Ship', 'Train', 'Car', 'Bike', 'Bolt', 'Star',
  'Sun', 'Moon', 'Cloud', 'Crown', 'Diamond', 'Gem', 'Anchor',
];

describe('the team icon set', () => {
  it('keeps every first-shipped key, in its place, ahead of the keys appended since', () => {
    expect(TEAM_ICON_KEYS.slice(0, FIRST_ICON_KEYS.length)).toEqual(FIRST_ICON_KEYS);
  });

  it('holds no key twice, and parses every key a team may hold', () => {
    expect(new Set(TEAM_ICON_KEYS).size).toBe(TEAM_ICON_KEYS.length);
    for (const icon of TEAM_ICON_KEYS) expect(teamIconSchema.safeParse(icon).success).toBe(true);
    expect(teamIconSchema.safeParse('NotAnIcon').success).toBe(false);
  });

  it('carries the seasonal and event icons', () => {
    for (const icon of ['TreePine', 'Snowflake', 'Gift', 'PartyPopper', 'Trophy', 'Medal', 'Flame', 'Zap', 'Mountain', 'Leaf', 'Flower', 'Clover', 'Heart', 'Egg', 'Candy', 'Sword']) {
      expect(TEAM_ICON_KEYS).toContain(icon);
    }
  });
});
