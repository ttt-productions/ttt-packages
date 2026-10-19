import { describe, it, expect } from 'vitest';
import { displayNameReservationKey } from '../src/utils/display-name-reservation';
import { workRealmNameReservationKey } from '../src/utils/work-realm-name';
import * as utils from '../src/utils/index';

describe('displayNameReservationKey', () => {
  it('is exported from the utils entry, beside the Realm-name key', () => {
    expect(utils.displayNameReservationKey).toBe(displayNameReservationKey);
    expect(utils.workRealmNameReservationKey).toBe(workRealmNameReservationKey);
  });
});
