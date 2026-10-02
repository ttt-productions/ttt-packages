import { describe, it, expect } from 'vitest';
import { adminRosterOf, adminStandingOf, holdsAdminStanding } from '../src/utils/admin-standing';

const roster = { admins: ['a1', 'both'], jrAdmins: ['j1', 'both'] };

describe('adminStandingOf', () => {
  it('reads a full admin as admin', () => {
    expect(adminStandingOf(roster, 'a1')).toBe('admin');
  });

  it('reads a jrAdmin as jrAdmin', () => {
    expect(adminStandingOf(roster, 'j1')).toBe('jrAdmin');
  });

  it('reads a uid on neither list as none', () => {
    expect(adminStandingOf(roster, 'member')).toBe('none');
  });

  it('reads a uid on both lists as the full admin', () => {
    expect(adminStandingOf(roster, 'both')).toBe('admin');
  });
});

describe('holdsAdminStanding', () => {
  it('is true for a full admin and for a jrAdmin', () => {
    expect(holdsAdminStanding(roster, 'a1')).toBe(true);
    expect(holdsAdminStanding(roster, 'j1')).toBe(true);
  });

  it('is false for an account on neither list', () => {
    expect(holdsAdminStanding(roster, 'member')).toBe(false);
  });

  it('is false for every account when the roster document is absent, since an absent roster names no one', () => {
    expect(holdsAdminStanding(adminRosterOf(undefined), 'a1')).toBe(false);
  });
});

describe('adminRosterOf', () => {
  it('reads both lists from the stored document', () => {
    expect(adminRosterOf({ admins: ['a1'], jrAdmins: ['j1'] })).toEqual({ admins: ['a1'], jrAdmins: ['j1'] });
  });

  it('reads an absent document as an empty roster', () => {
    expect(adminRosterOf(undefined)).toEqual({ admins: [], jrAdmins: [] });
    expect(adminRosterOf(null)).toEqual({ admins: [], jrAdmins: [] });
  });

  it('reads a list that is not an array as empty and keeps the other list', () => {
    expect(adminRosterOf({ admins: 'a1', jrAdmins: ['j1'] })).toEqual({ admins: [], jrAdmins: ['j1'] });
  });

  it('drops entries that are not strings', () => {
    expect(adminRosterOf({ admins: ['a1', 7, null, { uid: 'x' }], jrAdmins: [] })).toEqual({
      admins: ['a1'],
      jrAdmins: [],
    });
  });

  it('reads a non-object document as an empty roster', () => {
    expect(adminRosterOf('admins')).toEqual({ admins: [], jrAdmins: [] });
    expect(adminRosterOf(['a1'])).toEqual({ admins: [], jrAdmins: [] });
  });
});
