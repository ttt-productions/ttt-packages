import { describe, expect, it } from 'vitest';
import {
  CONTACT_PHONE_INPUT,
  OPTIONAL_CONTACT_PHONE_INPUT,
} from '../src/constants/phone-fields.js';
import { checkPhoneField, phoneFieldRefusal } from '../src/utils/phone-field.js';
import { contactPhoneSchema } from '../src/schemas/atoms.js';
import { LeagueTeamContactSchema } from '../src/doc-schemas/league-team.js';
import { UserPrivateDataSchema } from '../src/doc-schemas/user-profile.js';

const TYPED_FORMS = ['8148231858', '(814) 823-1858', '814.823.1858', ' 814 823 1858 '];
const REFUSED = ['555-0100', '18148231858', '+1 814 823 1858', '014-823-1858', '814-123-1858'];

describe('the contact phones', () => {
  it('are US numbers, the team’s required and the account’s default optional', () => {
    expect(CONTACT_PHONE_INPUT).toMatchObject({ format: 'us', required: true });
    expect(OPTIONAL_CONTACT_PHONE_INPUT).toMatchObject({ format: 'us', required: false });
  });

  it('read every typed form of a number to its 10 digits, in the box and on the wire', () => {
    for (const text of TYPED_FORMS) {
      expect(checkPhoneField(CONTACT_PHONE_INPUT, text)).toEqual({
        ok: true,
        digits: '8148231858',
      });
      expect(contactPhoneSchema.parse(text)).toBe('8148231858');
    }
  });

  it('refuse a number that is not a full real US number, in the box and on the wire, with one message', () => {
    const message = phoneFieldRefusal(CONTACT_PHONE_INPUT, 'tooFewDigits');
    for (const text of REFUSED) {
      expect(checkPhoneField(CONTACT_PHONE_INPUT, text)).toEqual({ ok: false, reason: message });
      const wire = contactPhoneSchema.safeParse(text);
      expect(wire.success).toBe(false);
      expect(wire.error?.issues[0]?.message).toBe(message);
    }
  });

  it('refuse an empty team phone as empty, and read an empty default phone as none', () => {
    expect(checkPhoneField(CONTACT_PHONE_INPUT, '  ')).toEqual({
      ok: false,
      reason: 'Contact phone cannot be empty.',
    });
    expect(contactPhoneSchema.safeParse('').success).toBe(false);
    expect(checkPhoneField(OPTIONAL_CONTACT_PHONE_INPUT, '  ')).toEqual({ ok: true, digits: null });
  });

  it('name the field in the refusal', () => {
    expect(phoneFieldRefusal(OPTIONAL_CONTACT_PHONE_INPUT, 'invalidAreaCode')).toMatch(
      /^Default contact phone /,
    );
  });

  it('are stored only as the 10 digits', () => {
    const stored = { leagueId: 'L', updatedAt: 1 };
    expect(
      LeagueTeamContactSchema.safeParse({ ...stored, contactPhone: '8148231858' }).success,
    ).toBe(true);
    for (const contactPhone of ['814-823-1858', '', ...REFUSED]) {
      expect(LeagueTeamContactSchema.safeParse({ ...stored, contactPhone }).success).toBe(false);
    }
    const privateData = { email: 'p@example.test', updatedAt: 1 };
    expect(
      UserPrivateDataSchema.safeParse({ ...privateData, defaultContactPhone: '(814) 823-1858' })
        .success,
    ).toBe(false);
  });
});
