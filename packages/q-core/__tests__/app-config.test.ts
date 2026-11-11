import { describe, it, expect } from 'vitest';
import { AppConfigInvalidError } from '@ttt-productions/app-config-core';
import {
  APP_CONFIG_DEFINITION,
  STANDARD_MAINTENANCE_MESSAGE,
  isMaintenanceOn,
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
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: 'Playoffs start Friday.',
};

function invalidity(read: () => unknown): AppConfigInvalidError {
  try {
    read();
  } catch (error) {
    if (error instanceof AppConfigInvalidError) return error;
    throw error;
  }
  throw new Error('the read did not refuse the document');
}

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

describe('the app config document schema', () => {
  it('requires every setting: a document missing any one of them is refused', () => {
    for (const setting of APP_CONFIG_DEFINITION.settings) {
      const missingOne: Record<string, unknown> = { ...COMPLETE };
      delete missingOne[setting];
      expect(AppConfigSchema.safeParse(missingOne).success).toBe(false);
    }
  });

  it('holds the version, the maintenance message, registration, and the announcement, with no maintenance switch', () => {
    expect([...APP_CONFIG_DEFINITION.settings].sort()).toEqual([
      'announcementMessage',
      'appVersion',
      'maintenanceMessage',
      'registrationEnabled',
    ]);
  });

  it('accepts empty messages, which are how maintenance and the banner are off', () => {
    expect(
      AppConfigSchema.safeParse({ ...COMPLETE, maintenanceMessage: '', announcementMessage: '' })
        .success,
    ).toBe(true);
  });
});

describe('APP_CONFIG_DEFINITION — what Q-Sports hands the app config package', () => {
  it('reads _appConfig/app', () => {
    expect(APP_CONFIG_DEFINITION.path).toBe('_appConfig/app');
    expect(invalidity(() => APP_CONFIG_DEFINITION.read(null)).message).toBe(
      '_appConfig/app does not exist.',
    );
  });

  it('reads the settings through the Q-Sports schema, which caps each text', () => {
    expect(APP_CONFIG_DEFINITION.read(COMPLETE)).toEqual(COMPLETE);
    expect(
      invalidity(() =>
        APP_CONFIG_DEFINITION.read({
          ...COMPLETE,
          maintenanceMessage: 'x'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1),
        }),
      ).setting,
    ).toBe('maintenanceMessage');
  });
});

describe('maintenance — the maintenance message alone decides it', () => {
  it('is off while the message is empty and on while it holds text', () => {
    expect(isMaintenanceOn(APP_CONFIG_DEFINITION.read(COMPLETE))).toBe(false);
    expect(
      isMaintenanceOn(
        APP_CONFIG_DEFINITION.read({ ...COMPLETE, maintenanceMessage: 'Back at nine.' }),
      ),
    ).toBe(true);
  });

  it('is off for a stored message of blanks, which reads as empty', () => {
    const blanks = APP_CONFIG_DEFINITION.read({ ...COMPLETE, maintenanceMessage: '   ' });
    expect(blanks.maintenanceMessage).toBe('');
    expect(isMaintenanceOn(blanks)).toBe(false);
  });

  it('has a standard sentence that fits the message and names no other product (RULE-STD-ARCH-006)', () => {
    expect(STANDARD_MAINTENANCE_MESSAGE.trim().length).toBeGreaterThan(0);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        maintenanceMessage: STANDARD_MAINTENANCE_MESSAGE,
      }).success,
    ).toBe(true);
    expect(STANDARD_MAINTENANCE_MESSAGE).not.toMatch(/ttt/i);
  });

  it('is never filled in: a stored empty message reads as empty, not as the standard sentence', () => {
    expect(APP_CONFIG_DEFINITION.read(COMPLETE).maintenanceMessage).toBe('');
  });

  it('is turned on by setting the message, and off by clearing it', () => {
    const on = APP_CONFIG_DEFINITION.merge(COMPLETE, { maintenanceMessage: 'Back at nine.' });
    expect(on.changes).toEqual({ maintenanceMessage: 'Back at nine.' });
    expect(isMaintenanceOn(on.after)).toBe(true);
    const off = APP_CONFIG_DEFINITION.merge(on.after, { maintenanceMessage: '' });
    expect(off.changes).toEqual({ maintenanceMessage: '' });
    expect(isMaintenanceOn(off.after)).toBe(false);
  });
});

describe('AdminUpdateAppConfigInputSchema', () => {
  it('accepts one lever or several, as named fields', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ appVersion: '2.1.0' }).success).toBe(true);
    expect(
      AdminUpdateAppConfigInputSchema.safeParse({
        registrationEnabled: false,
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
    expect(AdminUpdateAppConfigInputSchema.safeParse({ registrationEnabled: 'true' }).success).toBe(
      false,
    );
  });

  it('has no maintenance switch: maintenance is turned on and off through its message', () => {
    expect(AdminUpdateAppConfigInputSchema.safeParse({ maintenanceMode: true }).success).toBe(
      false,
    );
    expect(AdminUpdateAppConfigInputSchema.safeParse({ maintenanceMessage: '' }).success).toBe(
      true,
    );
  });

  it('answers with the names of the levers it changed', () => {
    expect(
      AdminUpdateAppConfigResultSchema.safeParse({
        updatedFields: ['appVersion', 'maintenanceMessage'],
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateAppConfigResultSchema.safeParse({ updatedFields: ['notALever'] }).success,
    ).toBe(false);
    expect(
      AdminUpdateAppConfigResultSchema.safeParse({ updatedFields: ['maintenanceMode'] }).success,
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
