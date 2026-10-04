import { describe, it, expect } from 'vitest';
import { workRealmNameReservationKey } from '../src/utils/work-realm-name';
import {
  CheckRealmNameAvailableInputSchema,
  CreateWorkProjectInputSchema,
  UpdateWorkRealmDetailsInputSchema,
  realmWorkingTitleSchema,
} from '../src/schemas/work-project-management';
import { documentIdSegmentSchema } from '../src/schemas/atoms';
import { validateHallContentTextFields } from '../src/utils/hall-content';

describe('workRealmNameReservationKey', () => {
  it('reserves one name however it is cased or padded', () => {
    expect(workRealmNameReservationKey(' Dragonlands ')).toBe('DRAGONLANDS');
    expect(workRealmNameReservationKey('dragonlands')).toBe(workRealmNameReservationKey('DragonLands'));
  });
});

describe('realmWorkingTitleSchema', () => {
  it('stores the trimmed name', () => {
    expect(realmWorkingTitleSchema.parse('  Dragonlands  ')).toBe('Dragonlands');
  });

  it('refuses a blank or whitespace-only name', () => {
    expect(realmWorkingTitleSchema.safeParse('').success).toBe(false);
    expect(realmWorkingTitleSchema.safeParse('    ').success).toBe(false);
  });

  it('refuses every character that could break its reservation key', () => {
    for (const name of ['a/b', '.', '..', '__ROOT__', 'Dragon.lands', 'Dragon_lands']) {
      expect(realmWorkingTitleSchema.safeParse(name).success).toBe(false);
    }
  });

  it('gives every name it accepts a reservation key that is one document-id segment', () => {
    for (const name of ['Dragonlands', 'The 9 Realms', 'a', 'Z'.repeat(150), ' Two  Spaces ']) {
      const parsed = realmWorkingTitleSchema.parse(name);
      expect(documentIdSegmentSchema.safeParse(workRealmNameReservationKey(parsed)).success).toBe(true);
    }
  });
});

describe('one Realm-name declaration on every path', () => {
  const realmId = 'realm1';
  const create = (realmWorkingTitle: string) =>
    CreateWorkProjectInputSchema.safeParse({
      workingTitle: 'Work',
      workingDescription: 'Desc',
      workProjectType: 'Tales',
      hallWingType: 'entertainment',
      realmCreationMode: 'newPublicRealm',
      realmWorkingTitle,
      realmWorkingDescription: 'Realm desc',
    });
  const check = (workingTitle: string) => CheckRealmNameAvailableInputSchema.safeParse({ workingTitle });
  const rename = (workingTitle: string) =>
    UpdateWorkRealmDetailsInputSchema.safeParse({ workRealmId: realmId, workingTitle });

  it('create, availability, and rename trim and refuse alike', () => {
    for (const parse of [create, check, rename]) {
      expect(parse('a/b').success).toBe(false);
      expect(parse('   ').success).toBe(false);
    }
    const created = create(' Dragonlands ');
    expect(created.success && created.data.realmCreationMode === 'newPublicRealm' && created.data.realmWorkingTitle).toBe('Dragonlands');
    const renamed = rename(' Dragonlands ');
    expect(renamed.success && renamed.data.workingTitle).toBe('Dragonlands');
  });

  it('the change-request checker refuses a proposed Realm name the declaration refuses', () => {
    expect(validateHallContentTextFields('workRealm', { workingTitle: 'a/b' }).ok).toBe(false);
    expect(validateHallContentTextFields('workRealm', { workingTitle: ' Dragonlands ' })).toEqual({
      ok: true,
      fields: { workingTitle: 'Dragonlands' },
    });
  });

  it('the checker judges each field by its own declaration', () => {
    expect(validateHallContentTextFields('workRealm', { workingDescription: 'a/b — anything goes' }).ok).toBe(true);
    expect(validateHallContentTextFields('tale', { title: 'a/b' }).ok).toBe(false);
  });
});
