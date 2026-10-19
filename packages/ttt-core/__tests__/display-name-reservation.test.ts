import { describe, it, expect } from 'vitest';
import { displayNameReservationKey } from '../src/utils/display-name-reservation';
import { displayNameSchema } from '../src/schemas/users';
import { documentIdSegmentSchema } from '../src/schemas/atoms';

describe('displayNameReservationKey', () => {
  it('keys names that differ only by case to one reservation', () => {
    expect(displayNameReservationKey('Ada')).toBe('ADA');
    expect(displayNameReservationKey('ada')).toBe(displayNameReservationKey('ADA'));
  });

  it('matches a blocked name however the member cases it', () => {
    const blocked = new Set(['ADMIN'].map(displayNameReservationKey));
    for (const name of ['admin', 'Admin', 'aDmIn']) {
      expect(blocked.has(displayNameReservationKey(name)), name).toBe(true);
    }
  });

  it('gives every display name the declaration accepts a key that is one document-id segment', () => {
    for (const name of ['Ada', 'abc', 'User123', 'Z'.repeat(20)]) {
      const parsed = displayNameSchema.parse(name);
      expect(documentIdSegmentSchema.safeParse(displayNameReservationKey(parsed)).success, name).toBe(true);
    }
  });

  it('never accepts a display name whose key would not be one document-id segment', () => {
    for (const name of ['ab/cd', '..', '__abc__']) {
      expect(documentIdSegmentSchema.safeParse(displayNameReservationKey(name)).success, name).toBe(false);
      expect(displayNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

});
