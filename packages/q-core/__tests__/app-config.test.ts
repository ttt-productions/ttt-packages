import { describe, it, expect } from 'vitest';
import {
  APP_CONFIG_LEVER_KEYS,
  DEFAULT_APP_CONFIG,
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_REFUSAL_CODE,
  MAINTENANCE_REFUSAL_REASON,
  isMaintenanceRefusalDetails,
  isMaintenanceRefusalError,
  mergeAppConfigUpdate,
  readAppConfigLever,
  readAppConfigLevers,
} from '../src/utils/app-config.js';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_LANDING_ABOUT_TEXT_LENGTH,
  MAX_LANDING_HERO_TITLE_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
} from '../src/constants/business.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import {
  AppConfigSchema,
  LandingPageConfigSchema,
  StatsBeaconSchema,
} from '../src/doc-schemas/system.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import {
  AdminUpdateLandingPageInputSchema,
  AdminUpdateAppConfigInputSchema,
  AdminUpdateAppConfigResultSchema,
} from '../src/schemas/app-config.js';

const COMPLETE = {
  appVersion: '2.0.1',
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: 'Playoffs start Friday.',
};

describe('the _appConfig documents', () => {
  it('live in the public bucket under their fixed ids, each bound to its schema', () => {
    expect(toPath(PATH_BUILDERS.appConfig())).toBe('_appConfig/app');
    expect(toPath(PATH_BUILDERS.landingPageConfig())).toBe('_appConfig/landingPage');
    expect(toPath(PATH_BUILDERS.statsBeacon())).toBe('_appConfig/statsBeacon');
    expect(COLLECTION_SCHEMAS['_appConfig/app']).toBe(AppConfigSchema);
    expect(COLLECTION_SCHEMAS['_appConfig/landingPage']).toBe(LandingPageConfigSchema);
    expect(COLLECTION_SCHEMAS['_appConfig/statsBeacon']).toBe(StatsBeaconSchema);
  });
});

describe('the app config levers at rest', () => {
  it('are the open posture: maintenance off, registration open, no banner, no version published', () => {
    expect(DEFAULT_APP_CONFIG).toEqual({
      appVersion: '',
      maintenanceMode: false,
      maintenanceMessage: '',
      registrationEnabled: true,
      announcementMessage: '',
    });
  });

  it('parse under the document schema, so a fresh environment behaves as a valid document', () => {
    expect(AppConfigSchema.safeParse(DEFAULT_APP_CONFIG).success).toBe(true);
  });

  it('name every field the document schema declares, and nothing else', () => {
    expect([...APP_CONFIG_LEVER_KEYS].sort()).toEqual(Object.keys(DEFAULT_APP_CONFIG).sort());
    expect([...APP_CONFIG_LEVER_KEYS].sort()).toEqual(Object.keys(AppConfigSchema.shape).sort());
  });
});

describe('readAppConfigLever — the one read rule', () => {
  it('reads a stored value its schema field accepts', () => {
    expect(readAppConfigLever(COMPLETE, 'announcementMessage')).toBe('Playoffs start Friday.');
    expect(readAppConfigLever({ maintenanceMode: true }, 'maintenanceMode')).toBe(true);
    expect(readAppConfigLever({ registrationEnabled: false }, 'registrationEnabled')).toBe(false);
  });

  it('falls back to the default for a missing document or a missing field', () => {
    expect(readAppConfigLever(undefined, 'maintenanceMode')).toBe(false);
    expect(readAppConfigLever(null, 'registrationEnabled')).toBe(true);
    expect(readAppConfigLever({}, 'appVersion')).toBe('');
  });

  it('throws for a stored value the schema refuses, naming the lever, and never reads it as a default', () => {
    expect(() => readAppConfigLever({ maintenanceMode: 'true' }, 'maintenanceMode')).toThrow(
      /_appConfig\/app\.maintenanceMode does not match its schema/,
    );
    expect(() => readAppConfigLever({ registrationEnabled: 0 }, 'registrationEnabled')).toThrow(
      /registrationEnabled/,
    );
    expect(() =>
      readAppConfigLever(
        { maintenanceMessage: 'x'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1) },
        'maintenanceMessage',
      ),
    ).toThrow(/maintenanceMessage/);
  });

  it('throws for a whole document holding one bad field', () => {
    expect(() => readAppConfigLevers({ ...COMPLETE, maintenanceMode: 'yes' })).toThrow(
      /maintenanceMode/,
    );
  });

  it('reads a missing document as the open posture', () => {
    expect(readAppConfigLevers(undefined)).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe('mergeAppConfigUpdate — the one write rule', () => {
  it('writes a missing document whole, from the defaults', () => {
    expect(mergeAppConfigUpdate(undefined, { maintenanceMode: true })).toEqual({
      ...DEFAULT_APP_CONFIG,
      maintenanceMode: true,
    });
  });

  it('heals a partial document: its missing fields come from the defaults and its own values stay', () => {
    expect(mergeAppConfigUpdate({ appVersion: '1.4.0' }, { registrationEnabled: false })).toEqual({
      ...DEFAULT_APP_CONFIG,
      appVersion: '1.4.0',
      registrationEnabled: false,
    });
  });

  it('changes nothing for a field the update leaves undefined', () => {
    expect(
      mergeAppConfigUpdate(COMPLETE, { appVersion: '2.0.2', maintenanceMode: undefined }),
    ).toEqual({
      ...COMPLETE,
      appVersion: '2.0.2',
    });
  });

  it('writes the value an update sends over a stored value the schema refuses', () => {
    expect(
      mergeAppConfigUpdate({ ...COMPLETE, maintenanceMode: 'yes' }, { maintenanceMode: true }),
    ).toEqual({ ...COMPLETE, maintenanceMode: true });
  });

  it('never replaces a stored value the schema refuses with a default: an update that leaves it is refused', () => {
    expect(() =>
      mergeAppConfigUpdate(
        { ...COMPLETE, appVersion: 'v'.repeat(MAX_APP_VERSION_LENGTH + 1) },
        { maintenanceMode: true },
      ),
    ).toThrow(/appVersion/);
  });

  it('refuses an update that would not parse, so an invalid document is never written', () => {
    expect(() =>
      mergeAppConfigUpdate(COMPLETE, {
        maintenanceMessage: 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1),
      }),
    ).toThrow(/maintenanceMessage/);
  });
});

describe('the maintenance refusal', () => {
  const refusal = {
    code: MAINTENANCE_REFUSAL_CODE,
    details: { reason: MAINTENANCE_REFUSAL_REASON },
  };

  it('is recognised by its code and its details, in the server and the client SDK spelling', () => {
    expect(isMaintenanceRefusalError(refusal)).toBe(true);
    expect(
      isMaintenanceRefusalError({ ...refusal, code: `functions/${MAINTENANCE_REFUSAL_CODE}` }),
    ).toBe(true);
    expect(isMaintenanceRefusalDetails({ reason: MAINTENANCE_REFUSAL_REASON })).toBe(true);
  });

  it('is never confused with a real outage, which carries the same code and no details', () => {
    expect(isMaintenanceRefusalError({ code: 'unavailable' })).toBe(false);
    expect(
      isMaintenanceRefusalError({ code: 'unavailable', details: { reason: 'overloaded' } }),
    ).toBe(false);
    expect(isMaintenanceRefusalError({ code: 'permission-denied', details: refusal.details })).toBe(
      false,
    );
    expect(isMaintenanceRefusalError(null)).toBe(false);
    expect(isMaintenanceRefusalError('unavailable')).toBe(false);
  });

  it('has a default line for when the operator leaves the message blank, with no ttt name (RULE-STD-ARCH-006)', () => {
    expect(DEFAULT_MAINTENANCE_MESSAGE.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_MAINTENANCE_MESSAGE).not.toMatch(/ttt/i);
  });
});

describe('AdminUpdateAppConfigInputSchema', () => {
  it('accepts one lever or several, as named fields', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ appVersion: '2.1.0' }).success).toBe(true);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        maintenanceMode: true,
        maintenanceMessage: 'Back at nine.',
      }).success,
    ).toBe(true);
  });

  it('accepts an empty announcement, which is how the banner is turned off', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ announcementMessage: '' }).success).toBe(
      true,
    );
  });

  it('refuses a request that changes nothing', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({}).success).toBe(false);
  });

  it('refuses an unknown key, a document id, and a data blob (RULE-STD-BACKEND-209)', () => {
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({ appVersion: '2', statsUpdatedAt: 1 }).success,
    ).toBe(false);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { appVersion: '2' } })
        .success,
    ).toBe(false);
  });

  it('refuses a blank version and every text over its cap', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ appVersion: '   ' }).success).toBe(false);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        appVersion: 'v'.repeat(MAX_APP_VERSION_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        announcementMessage: 'a'.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        maintenanceMessage: 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('trims the version and the messages before keeping them', () => {
    expect(
      AdminUpdateAppConfigInputSchema.parse({
        appVersion: ' 2.1.0 ',
        maintenanceMessage: ' Back at nine. ',
      }),
    ).toEqual({
      appVersion: '2.1.0',
      maintenanceMessage: 'Back at nine.',
    });
  });

  it('refuses a lever of the wrong type', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ maintenanceMode: 'true' }).success).toBe(
      false,
    );
  });

  it('answers with the names of the levers it changed', () => {
    expect(
      AdminUpdateAppConfigResultSchema.safeParse({
        updatedFields: ['appVersion', 'maintenanceMode'],
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateAppConfigResultSchema.safeParse({ updatedFields: ['notALever'] }).success,
    ).toBe(false);
  });
});

describe('the landing page copy', () => {
  it('stores the copy with an optional gallery summary; an absent summary is an empty gallery', () => {
    expect(
      LandingPageConfigSchema.safeParse({
        heroTitle: 'Q-Sports',
        aboutCompany: 'Friends play.',
        updatedAt: 1,
      }).success,
    ).toBe(true);
    expect(
      LandingPageConfigSchema.safeParse({
        heroTitle: 'Q-Sports',
        aboutCompany: '',
        pictures: {
          count: 1,
          featuredPictureId: '6a1c0f3e-2b4d-4c5e-9f7a-8b0c1d2e3f40',
          updatedAt: 2,
        },
        updatedAt: 1,
      }).success,
    ).toBe(true);
  });

  it('carries no stored image URLs', () => {
    expect(Object.keys(LandingPageConfigSchema.shape)).not.toContain('images');
  });

  it('is edited one field at a time: a save sends only the fields the admin changed', () => {
    expect(AdminUpdateLandingPageInputSchema.safeParse({ heroTitle: 'Welcome' }).success).toBe(
      true,
    );
    expect(AdminUpdateLandingPageInputSchema.safeParse({ aboutCompany: 'We play.' }).success).toBe(
      true,
    );
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({ heroTitle: 'Welcome', aboutCompany: '' })
        .success,
    ).toBe(true);
    expect(AdminUpdateLandingPageInputSchema.safeParse({}).success).toBe(false);
  });

  it('saves a cleared title as blank, so the default heading shows', () => {
    expect(AdminUpdateLandingPageInputSchema.parse({ heroTitle: '' }).heroTitle).toBe('');
    expect(AdminUpdateLandingPageInputSchema.parse({ heroTitle: '   ' }).heroTitle).toBe('');
  });

  it('keeps each field within its cap', () => {
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({
        heroTitle: 't'.repeat(MAX_LANDING_HERO_TITLE_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({
        heroTitle: 't'.repeat(MAX_LANDING_HERO_TITLE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({
        aboutCompany: 'a'.repeat(MAX_LANDING_ABOUT_TEXT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("keeps the title to one line, and the about text's line breaks", () => {
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({ heroTitle: 'Wel\ncome', aboutCompany: '' })
        .success,
    ).toBe(false);
    expect(
      AdminUpdateLandingPageInputSchema.parse({
        heroTitle: 'Welcome',
        aboutCompany: 'We play.\nYou too.',
      }).aboutCompany,
    ).toBe('We play.\nYou too.');
  });

  it('never lets the copy editor send the gallery or an unknown field', () => {
    expect(
      AdminUpdateLandingPageInputSchema.safeParse({
        heroTitle: 'Welcome',
        aboutCompany: '',
        pictures: { count: 0, updatedAt: 1 },
      }).success,
    ).toBe(false);
  });
});

describe('the stats beacon', () => {
  it('carries the change id each write mints, and reads a beacon stored without one', () => {
    expect(
      StatsBeaconSchema.parse({
        updatedAt: 5,
        action: 'finalize',
        changeId: 'aB3dE5gH7jK9mN1pQ3sT',
      }).changeId,
    ).toBe('aB3dE5gH7jK9mN1pQ3sT');
    expect(StatsBeaconSchema.parse({ updatedAt: 5, action: 'finalize' }).changeId).toBeUndefined();
    expect(
      StatsBeaconSchema.safeParse({ updatedAt: 5, action: 'finalize', changeId: '' }).success,
    ).toBe(false);
    expect(
      StatsBeaconSchema.safeParse({ updatedAt: 5, action: 'finalize', changeId: 'a/b' }).success,
    ).toBe(false);
  });

  it('holds the action and, when one game or league changed, its scope ids', () => {
    expect(StatsBeaconSchema.safeParse({ updatedAt: 5, action: 'recalculate' }).success).toBe(true);
    expect(
      StatsBeaconSchema.safeParse({
        updatedAt: 5,
        action: 'finalize',
        leagueId: 'L1',
        gameId: 'G1',
        teamIds: ['T1', 'T2'],
      }).success,
    ).toBe(true);
  });

  it('refuses a timestamp that is not epoch milliseconds (RULE-STD-ARCH-105) and an unknown action', () => {
    expect(
      StatsBeaconSchema.safeParse({ updatedAt: '2026-01-01', action: 'finalize' }).success,
    ).toBe(false);
    expect(StatsBeaconSchema.safeParse({ updatedAt: 5, action: 'reset' }).success).toBe(false);
  });
});
