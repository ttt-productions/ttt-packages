// A form's declared field format and the callable schema that enforces the same field accept exactly
// the same text (ARCH-102): the repair reason's wire schema is built from its one declaration, so the
// reason a confirmation takes is the reason the repair callables parse — trimmed, then bounded by the
// repair-reason limits — with any character and line breaks; a person's and a team's name, and a
// team's contact phone, are one line, trimmed, within their length limits; a refusal names the bound
// it missed; a join request's message is the one its callable parses, 10 to 500 characters after trimming; an
// invitation's note is optional, empty or blank allowed, up to its cap; and every admin form's text field — a
// venue's, a schedule week's, a waiver template's (kept exactly as typed), the landing copy, and the app
// settings — is the one its callable parses.

import { describe, expect, it } from 'vitest';
import { checkInputFormat, defineInputFormat } from '@ttt-productions/input-format-core';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_CONTACT_PHONE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_GAME_LOCATION_MEMO_LENGTH,
  MAX_GAME_LOCATION_NAME_LENGTH,
  MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH,
  MAX_GAME_LOCATION_SUB_LOCATION_LENGTH,
  MAX_GAME_MEMO_LENGTH,
  MAX_LANDING_ABOUT_TEXT_LENGTH,
  MAX_LANDING_HERO_TITLE_LENGTH,
  MAX_LEAGUE_DESCRIPTION_LENGTH,
  MAX_LEAGUE_TITLE_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
  MAX_REPAIR_REASON_LENGTH,
  MAX_SCHEDULE_WEEK_TITLE_LENGTH,
  MAX_TEAM_INVITATION_MESSAGE_LENGTH,
  MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_WAIVER_TEMPLATE_TEXT_LENGTH,
  MAX_WAIVER_TEMPLATE_TITLE_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  MIN_LEAGUE_DESCRIPTION_LENGTH,
  MIN_LEAGUE_TITLE_LENGTH,
  MIN_REPAIR_REASON_LENGTH,
  MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MIN_TEAM_NAME_LENGTH,
} from '../src/constants/business.js';
import {
  ANNOUNCEMENT_MESSAGE_INPUT_FORMAT,
  APP_VERSION_INPUT_FORMAT,
  CONTACT_PHONE_INPUT_FORMAT,
  OPTIONAL_CONTACT_PHONE_INPUT_FORMAT,
  LEAGUE_DESCRIPTION_INPUT_FORMAT,
  LEAGUE_TITLE_INPUT_FORMAT,
  DISPLAY_NAME_INPUT_FORMAT,
  GAME_LOCATION_MEMO_INPUT_FORMAT,
  GAME_LOCATION_NAME_INPUT_FORMAT,
  GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT,
  GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT,
  GAME_MEMO_INPUT_FORMAT,
  LANDING_ABOUT_TEXT_INPUT_FORMAT,
  LANDING_HERO_TITLE_INPUT_FORMAT,
  MAINTENANCE_MESSAGE_INPUT_FORMAT,
  REPAIR_REASON_INPUT_FORMAT,
  SCHEDULE_WEEK_TITLE_INPUT_FORMAT,
  TEAM_INVITATION_MESSAGE_INPUT_FORMAT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT,
  TEAM_NAME_INPUT_FORMAT,
  WAIVER_TEMPLATE_TEXT_INPUT_FORMAT,
  WAIVER_TEMPLATE_TITLE_INPUT_FORMAT,
} from '../src/input-formats/input-formats.js';
import { LeagueTeamContactSchema } from '../src/doc-schemas/league-team.js';
import { repairReasonSchema, textFieldSchema } from '../src/doc-schemas/atoms.js';
import {
  AdminUpdateLandingPageInputSchema,
  UpdateAppConfigInputSchema,
} from '../src/schemas/app-config.js';
import {
  AdminUpdateLeagueTeamContactInputSchema,
  AdminUpdateLeagueTeamNameInputSchema,
  CreateTeamGhostPlayerInputSchema,
} from '../src/schemas/teams.js';
import {
  contactPhoneSchema,
  displayNameSchema,
  teamInvitationMessageSchema,
  teamJoinRequestMessageSchema,
  teamNameSchema,
} from '../src/schemas/atoms.js';
import {
  gameLocationMemoSchema,
  gameLocationNameSchema,
  gameLocationStreetAddressSchema,
  gameLocationSubLocationSchema,
} from '../src/schemas/game-locations.js';
import { gameMemoSchema } from '../src/schemas/scoring.js';
import { leagueDescriptionSchema, leagueTitleSchema } from '../src/schemas/leagues.js';
import { scheduleWeekTitleSchema } from '../src/schemas/schedules.js';
import {
  waiverTemplateTextSchema,
  waiverTemplateTitleSchema,
} from '../src/schemas/waiver-templates.js';

describe('the repair reason', () => {
  it('is declared from the repair-reason limits, any character and line breaks allowed', () => {
    expect(REPAIR_REASON_INPUT_FORMAT).toMatchObject({
      format: 'none',
      min: MIN_REPAIR_REASON_LENGTH,
      max: MAX_REPAIR_REASON_LENGTH,
    });
  });

  it('is parsed on the wire by the check its declaration runs, keeping the trimmed text', () => {
    expect(repairReasonSchema.parse('  Fixed the league id\nand replayed it  ')).toBe(
      'Fixed the league id\nand replayed it',
    );
    expect(repairReasonSchema.parse('x'.repeat(MAX_REPAIR_REASON_LENGTH))).toBe('x'.repeat(MAX_REPAIR_REASON_LENGTH));
  });

  it('refuses a blank reason, one a character short once trimmed, and one past the cap', () => {
    expect(repairReasonSchema.safeParse('   ').success).toBe(false);
    expect(repairReasonSchema.safeParse(`  ${'x'.repeat(MIN_REPAIR_REASON_LENGTH - 1)}  `).success).toBe(false);
    expect(repairReasonSchema.safeParse('x'.repeat(MAX_REPAIR_REASON_LENGTH + 1)).success).toBe(false);
  });
});

describe('a text field built from its declaration', () => {
  it('follows the declaration it is built from, so a changed bound moves the wire with the form', () => {
    const declaration = defineInputFormat({ format: 'englishNormal', min: 2, max: 4 });
    const schema = textFieldSchema(declaration);
    for (const text of ['', ' a ', 'ab', ' abcd ', 'abcde', 'a\nb', 'a-b']) {
      const check = checkInputFormat(text, declaration);
      const wire = schema.safeParse(text);
      expect(wire.success, JSON.stringify(text)).toBe(check.ok);
      if (check.ok && wire.success) expect(wire.data).toBe(check.value);
    }
  });

  it('names the issue and the bounds a refused text missed', () => {
    const schema = textFieldSchema(defineInputFormat({ format: 'englishNormal', min: 2, max: 4 }));
    const short = schema.safeParse('a');
    const long = schema.safeParse('abcde');
    const characters = schema.safeParse('a-b');
    expect(short.success ? null : short.error.issues[0]).toMatchObject({ params: { issue: 'tooShort', min: 2, max: 4 } });
    expect(long.success ? null : long.error.issues[0]).toMatchObject({ params: { issue: 'tooLong', min: 2, max: 4 } });
    expect(characters.success ? null : characters.error.issues[0]).toMatchObject({ params: { issue: 'invalidCharacters' } });
  });
});

/** Texts on and around a field's bounds, padded and unpadded, with line breaks and wide characters. */
function boundarySamples(min: number, max: number): string[] {
  return [
    '',
    '   ',
    ...(min > 0 ? ['x'.repeat(min - 1), `  ${'x'.repeat(min - 1)}  `] : []),
    'x'.repeat(Math.max(min, 1)),
    `  ${'x'.repeat(Math.max(min, 1))}  `,
    'I play guard\nand can make Tuesdays',
    'Ünïcödé — message ✓',
    'x'.repeat(max),
    `  ${'x'.repeat(max)}  `,
    'x'.repeat(max + 1),
  ];
}

describe("a join request's message", () => {
  it('is declared from the join-request message limits', () => {
    expect(TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT.min).toBe(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH);
    expect(TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT.max).toBe(MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH);
  });

  it('accepts exactly the text the callable schema accepts, and keeps the same trimmed value', () => {
    for (const sample of boundarySamples(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH, MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH)) {
      const field = checkInputFormat(sample, TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT);
      const wire = teamJoinRequestMessageSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it('is the wire schema built from that one declaration: a refusal names the declared bounds', () => {
    const refused = teamJoinRequestMessageSchema.safeParse('too short');
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]).toMatchObject({
      params: {
        issue: 'tooShort',
        min: TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT.min,
        max: TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT.max,
      },
    });
  });

  it('refuses nine characters padded to ten, and one past the cap', () => {
    const nine = 'x'.repeat(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH - 1);
    expect(checkInputFormat(` ${nine} `, TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT).ok).toBe(false);
    expect(
      checkInputFormat('x'.repeat(MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH + 1), TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT).ok,
    ).toBe(false);
  });
});

describe("an invitation's note", () => {
  it('is optional and declared from the invitation note cap', () => {
    expect(TEAM_INVITATION_MESSAGE_INPUT_FORMAT.min).toBe(0);
    expect(TEAM_INVITATION_MESSAGE_INPUT_FORMAT.max).toBe(MAX_TEAM_INVITATION_MESSAGE_LENGTH);
  });

  it('accepts exactly the text the callable schema accepts, and keeps the same trimmed value', () => {
    for (const sample of boundarySamples(0, MAX_TEAM_INVITATION_MESSAGE_LENGTH)) {
      const field = checkInputFormat(sample, TEAM_INVITATION_MESSAGE_INPUT_FORMAT);
      const wire = teamInvitationMessageSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it('is the wire schema built from that one declaration: a refusal names the declared cap', () => {
    const refused = teamInvitationMessageSchema.safeParse('x'.repeat(MAX_TEAM_INVITATION_MESSAGE_LENGTH + 1));
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]).toMatchObject({
      params: { issue: 'tooLong', min: 0, max: TEAM_INVITATION_MESSAGE_INPUT_FORMAT.max },
    });
  });

  it('accepts an empty note, kept as the empty string', () => {
    expect(checkInputFormat('   ', TEAM_INVITATION_MESSAGE_INPUT_FORMAT)).toEqual({ ok: true, value: '', reformatted: false });
  });
});

describe("a scorer's memo on a person", () => {
  it('is optional, one line, and declared from the memo cap', () => {
    expect(GAME_MEMO_INPUT_FORMAT).toMatchObject({ format: 'singleLine', min: 0, max: MAX_GAME_MEMO_LENGTH });
  });

  it('accepts exactly the text the memo callable accepts, and keeps the same trimmed value', () => {
    for (const sample of [...boundarySamples(0, MAX_GAME_MEMO_LENGTH), 'red shirt', '  #9  ']) {
      const field = checkInputFormat(sample, GAME_MEMO_INPUT_FORMAT);
      const wire = gameMemoSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it('clears with a blank memo, kept as the empty string', () => {
    expect(gameMemoSchema.parse('   ')).toBe('');
  });

  it('refuses a memo past the cap and one that breaks the line', () => {
    expect(gameMemoSchema.safeParse('x'.repeat(MAX_GAME_MEMO_LENGTH + 1)).success).toBe(false);
    expect(gameMemoSchema.safeParse('red\nshirt').success).toBe(false);
  });
});

describe("a person's display name, a ghost's included", () => {
  it('is one line, declared from the display-name limits', () => {
    expect(DISPLAY_NAME_INPUT_FORMAT).toMatchObject({
      format: 'singleLine',
      min: MIN_DISPLAY_NAME_LENGTH,
      max: MAX_DISPLAY_NAME_LENGTH,
    });
  });

  it('accepts exactly the text the name schemas accept, and keeps the same trimmed value', () => {
    for (const sample of [...boundarySamples(MIN_DISPLAY_NAME_LENGTH, MAX_DISPLAY_NAME_LENGTH), '  Jane Doe  ']) {
      const field = checkInputFormat(sample, DISPLAY_NAME_INPUT_FORMAT);
      const wire = displayNameSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it("is the ghost add's name: a name split over two lines, or two characters once trimmed, is refused", () => {
    expect(CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't1', requestId: 'r1', displayName: 'Ghost\nOne' }).success).toBe(false);
    expect(CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't1', requestId: 'r1', displayName: '  Jo  ' }).success).toBe(false);
    expect(CreateTeamGhostPlayerInputSchema.parse({ teamId: 't1', requestId: 'r1', displayName: '  Ghost One  ' }).displayName).toBe(
      'Ghost One',
    );
  });
});

describe("a team's name", () => {
  it('is one line, declared from the team-name limits', () => {
    expect(TEAM_NAME_INPUT_FORMAT).toMatchObject({ format: 'singleLine', min: MIN_TEAM_NAME_LENGTH, max: MAX_TEAM_NAME_LENGTH });
  });

  it('accepts exactly the text the team-name schema accepts, and keeps the same trimmed value', () => {
    for (const sample of boundarySamples(MIN_TEAM_NAME_LENGTH, MAX_TEAM_NAME_LENGTH)) {
      const field = checkInputFormat(sample, TEAM_NAME_INPUT_FORMAT);
      const wire = teamNameSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it("is the rename's name: blank, two lines, and one past the cap are refused, and the kept name is trimmed", () => {
    const rename = (name: string) => AdminUpdateLeagueTeamNameInputSchema.safeParse({ teamId: 't1', name });
    expect(rename('   ').success).toBe(false);
    expect(rename('Night\nOwls').success).toBe(false);
    expect(rename('x'.repeat(MAX_TEAM_NAME_LENGTH + 1)).success).toBe(false);
    const kept = rename('  Night Owls  ');
    expect(kept.success && kept.data.name).toBe('Night Owls');
  });
});

describe("a team's contact phone", () => {
  it('is one line, required, and declared from the contact-phone cap', () => {
    expect(CONTACT_PHONE_INPUT_FORMAT).toMatchObject({ format: 'singleLine', min: 1, max: MAX_CONTACT_PHONE_LENGTH });
  });

  it('accepts exactly the text the contact-phone schema accepts, and keeps the same trimmed value', () => {
    for (const sample of boundarySamples(1, MAX_CONTACT_PHONE_LENGTH)) {
      const field = checkInputFormat(sample, CONTACT_PHONE_INPUT_FORMAT);
      const wire = contactPhoneSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });

  it('is the number the contact edit sends and the contact document stores, kept as typed once trimmed', () => {
    const edit = (contactPhone: string) => AdminUpdateLeagueTeamContactInputSchema.safeParse({ teamId: 't1', contactPhone });
    expect(edit('   ').success).toBe(false);
    expect(edit('555\n0100').success).toBe(false);
    expect(edit('5'.repeat(MAX_CONTACT_PHONE_LENGTH + 1)).success).toBe(false);
    const kept = edit('  (555) 010-0100 ext. 2  ');
    expect(kept.success && kept.data.contactPhone).toBe('(555) 010-0100 ext. 2');
    expect(LeagueTeamContactSchema.shape.contactPhone.safeParse('  555-0100  ').data).toBe('555-0100');
    expect(LeagueTeamContactSchema.shape.contactPhone.safeParse('').success).toBe(false);
  });
});

describe("a league's title and description", () => {
  it('are declared from the league limits: the title one line, the description with line breaks', () => {
    expect(LEAGUE_TITLE_INPUT_FORMAT).toMatchObject({ format: 'singleLine', min: MIN_LEAGUE_TITLE_LENGTH, max: MAX_LEAGUE_TITLE_LENGTH });
    expect(LEAGUE_DESCRIPTION_INPUT_FORMAT).toMatchObject({
      format: 'none',
      min: MIN_LEAGUE_DESCRIPTION_LENGTH,
      max: MAX_LEAGUE_DESCRIPTION_LENGTH,
    });
  });

  it('accept exactly the text the create and edit inputs accept, and keep the same trimmed value', () => {
    const pairs = [
      [LEAGUE_TITLE_INPUT_FORMAT, leagueTitleSchema, MIN_LEAGUE_TITLE_LENGTH, MAX_LEAGUE_TITLE_LENGTH],
      [LEAGUE_DESCRIPTION_INPUT_FORMAT, leagueDescriptionSchema, MIN_LEAGUE_DESCRIPTION_LENGTH, MAX_LEAGUE_DESCRIPTION_LENGTH],
    ] as const;
    for (const [declaration, schema, min, max] of pairs) {
      for (const sample of boundarySamples(min, max)) {
        const field = checkInputFormat(sample, declaration);
        const wire = schema.safeParse(sample);
        expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
        if (field.ok && wire.success) expect(field.value).toBe(wire.data);
      }
    }
    expect(leagueTitleSchema.safeParse('Spring\nRec').success).toBe(false);
    expect(leagueDescriptionSchema.parse('  Tuesday nights.\nBring water.  ')).toBe('Tuesday nights.\nBring water.');
  });
});

describe("the account's optional default contact phone", () => {
  it('is the contact-phone format with empty allowed', () => {
    expect(OPTIONAL_CONTACT_PHONE_INPUT_FORMAT).toMatchObject({ format: 'singleLine', min: 0, max: MAX_CONTACT_PHONE_LENGTH });
  });

  it('accepts empty — removing the saved number — and otherwise exactly what the contact-phone schema accepts', () => {
    expect(checkInputFormat('', OPTIONAL_CONTACT_PHONE_INPUT_FORMAT)).toMatchObject({ ok: true, value: '' });
    expect(checkInputFormat('   ', OPTIONAL_CONTACT_PHONE_INPUT_FORMAT)).toMatchObject({ ok: true, value: '' });
    for (const sample of boundarySamples(1, MAX_CONTACT_PHONE_LENGTH)) {
      if (sample.trim() === '') continue;
      const field = checkInputFormat(sample, OPTIONAL_CONTACT_PHONE_INPUT_FORMAT);
      const wire = contactPhoneSchema.safeParse(sample);
      expect(field.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
      if (field.ok && wire.success) expect(field.value).toBe(wire.data);
    }
  });
});

describe("a text field's refusal", () => {
  it('names the bound it missed, from the declaration it is built from', () => {
    const schema = textFieldSchema(defineInputFormat({ format: 'singleLine', min: 3, max: 5 }));
    expect(schema.safeParse('ab').error?.issues[0].message).toBe('At least 3 characters.');
    expect(schema.safeParse('abcdef').error?.issues[0].message).toBe('At most 5 characters.');
    expect(schema.safeParse('a\nbc').error?.issues[0].message).toBe('Holds a character this field does not allow.');
  });

  it('says a required field left blank is required', () => {
    const schema = textFieldSchema(defineInputFormat({ format: 'singleLine', min: 1, max: 5 }));
    expect(schema.safeParse('   ').error?.issues[0].message).toBe('Required.');
  });

  it("is the join request's own: a message under its minimum names that minimum", () => {
    expect(teamJoinRequestMessageSchema.safeParse('Hi there').error?.issues[0].message).toBe(
      `At least ${MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH} characters.`,
    );
  });
});

/**
 * The admin forms' text fields. Each field's form declaration and the wire schema its callable parses
 * accept exactly the same texts and keep the same value (ARCH-102), so each wire schema is the one
 * built from the field's declaration through `textFieldSchema`.
 */
describe("the admin forms' text fields", () => {
  const venueName = (text: string) => gameLocationNameSchema.safeParse(text);
  const streetAddress = (text: string) => gameLocationStreetAddressSchema.safeParse(text);
  const subLocation = (text: string) => gameLocationSubLocationSchema.safeParse(text);
  const venueMemo = (text: string) => gameLocationMemoSchema.safeParse(text);
  const weekTitle = (text: string) => scheduleWeekTitleSchema.safeParse(text);
  const waiverTitle = (text: string) => waiverTemplateTitleSchema.safeParse(text);
  const waiverText = (text: string) => waiverTemplateTextSchema.safeParse(text);
  const heroTitle = (text: string) => {
    const parsed = AdminUpdateLandingPageInputSchema.safeParse({ heroTitle: text, aboutCompany: '' });
    return parsed.success ? { success: true as const, data: parsed.data.heroTitle } : { success: false as const };
  };
  const aboutText = (text: string) => {
    const parsed = AdminUpdateLandingPageInputSchema.safeParse({ heroTitle: 'Q-Sports', aboutCompany: text });
    return parsed.success ? { success: true as const, data: parsed.data.aboutCompany } : { success: false as const };
  };
  const lever = (key: 'maintenanceMessage' | 'announcementMessage' | 'appVersion') => (text: string) => {
    const parsed = UpdateAppConfigInputSchema.safeParse({ [key]: text });
    return parsed.success ? { success: true as const, data: parsed.data[key] } : { success: false as const };
  };

  const fields = [
    { name: "a venue's name", declaration: GAME_LOCATION_NAME_INPUT_FORMAT, expected: { format: 'singleLine', min: 1, max: MAX_GAME_LOCATION_NAME_LENGTH }, wire: venueName },
    { name: "a venue's street address", declaration: GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT, expected: { format: 'singleLine', min: 1, max: MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH }, wire: streetAddress },
    { name: "a venue's sub-location", declaration: GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT, expected: { format: 'singleLine', min: 1, max: MAX_GAME_LOCATION_SUB_LOCATION_LENGTH }, wire: subLocation },
    { name: "a venue's memo", declaration: GAME_LOCATION_MEMO_INPUT_FORMAT, expected: { format: 'none', min: 0, max: MAX_GAME_LOCATION_MEMO_LENGTH }, wire: venueMemo },
    { name: "a schedule week's name", declaration: SCHEDULE_WEEK_TITLE_INPUT_FORMAT, expected: { format: 'singleLine', min: 1, max: MAX_SCHEDULE_WEEK_TITLE_LENGTH }, wire: weekTitle },
    { name: "a waiver template's title", declaration: WAIVER_TEMPLATE_TITLE_INPUT_FORMAT, expected: { format: 'singleLine', min: 1, max: MAX_WAIVER_TEMPLATE_TITLE_LENGTH, keepAsTyped: true }, wire: waiverTitle },
    { name: "a waiver template's wording", declaration: WAIVER_TEMPLATE_TEXT_INPUT_FORMAT, expected: { format: 'none', min: 1, max: MAX_WAIVER_TEMPLATE_TEXT_LENGTH, keepAsTyped: true }, wire: waiverText },
    { name: "the landing page's hero title", declaration: LANDING_HERO_TITLE_INPUT_FORMAT, expected: { format: 'singleLine', min: 0, max: MAX_LANDING_HERO_TITLE_LENGTH }, wire: heroTitle },
    { name: "the landing page's about text", declaration: LANDING_ABOUT_TEXT_INPUT_FORMAT, expected: { format: 'none', min: 0, max: MAX_LANDING_ABOUT_TEXT_LENGTH }, wire: aboutText },
    { name: 'the maintenance message', declaration: MAINTENANCE_MESSAGE_INPUT_FORMAT, expected: { format: 'none', min: 0, max: MAX_MAINTENANCE_MESSAGE_LENGTH }, wire: lever('maintenanceMessage') },
    { name: 'the announcement', declaration: ANNOUNCEMENT_MESSAGE_INPUT_FORMAT, expected: { format: 'none', min: 0, max: MAX_ANNOUNCEMENT_MESSAGE_LENGTH }, wire: lever('announcementMessage') },
    { name: 'the app version', declaration: APP_VERSION_INPUT_FORMAT, expected: { format: 'none', min: 1, max: MAX_APP_VERSION_LENGTH }, wire: lever('appVersion') },
  ] as const;

  for (const field of fields) {
    describe(field.name, () => {
      it('is declared from its limits', () => {
        expect(field.declaration).toMatchObject(field.expected);
      });

      it('accepts exactly the text its callable accepts, and keeps the same value', () => {
        for (const sample of boundarySamples(field.declaration.min, field.declaration.max)) {
          const form = checkInputFormat(sample, field.declaration);
          const wire = field.wire(sample);
          expect(form.ok, JSON.stringify(sample.slice(0, 20))).toBe(wire.success);
          if (form.ok && wire.success) expect(form.value).toBe(wire.data);
        }
      });
    });
  }

  it("keeps a waiver's words exactly as typed, and still refuses a blank one", () => {
    expect(checkInputFormat('  I agree.\n', WAIVER_TEMPLATE_TEXT_INPUT_FORMAT)).toEqual({ ok: true, value: '  I agree.\n', reformatted: false });
    expect(checkInputFormat('   ', WAIVER_TEMPLATE_TEXT_INPUT_FORMAT).ok).toBe(false);
  });
});
