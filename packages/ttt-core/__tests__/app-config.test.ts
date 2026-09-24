import { describe, it, expect } from 'vitest';
import { AppConfigSchema } from '../src/doc-schemas/system';
import { UpdateAppConfigInputSchema } from '../src/schemas/admin';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_MAINTENANCE_MESSAGE,
  mergeAppConfigUpdate,
  readAppConfigLever,
  readAppConfigLevers,
  type AppConfigLeverKey,
} from '../src/utils/app-config';
import { planPublicDocumentRelease } from '../src/utils/public-documents';
import { SPECIAL_DOCS } from '../src/paths/collections';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
} from '../src/constants/business-admin';
import * as root from '../src/index';
import * as utils from '../src/utils';

const block = planPublicDocumentRelease(undefined, [SPECIAL_DOCS.TERMS_PAGE], true).block;

describe('DEFAULT_APP_CONFIG — _appConfig/app at rest', () => {
  it('parses under AppConfigSchema', () => {
    expect(AppConfigSchema.safeParse(DEFAULT_APP_CONFIG).success).toBe(true);
  });

  it('is the open posture: maintenance off, registration open, no banner, no throttle', () => {
    expect(DEFAULT_APP_CONFIG).toEqual({
      appVersion: '',
      maintenanceMode: false,
      maintenanceMessage: '',
      registrationEnabled: true,
      announcementMessage: '',
      rateLimitMultiplier: 1,
    });
    expect(Object.isFrozen(DEFAULT_APP_CONFIG)).toBe(true);
  });

  it('publishes no app version, so VersionGate stays dormant until an operator sets a real one', () => {
    // VersionGate skips a falsy `appVersion`; any other default would reload every browser that
    // stored a different version before the doc was recreated.
    expect(DEFAULT_APP_CONFIG.appVersion).toBe('');
    expect(UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { appVersion: '' } }).success).toBe(false);
    expect(UpdateAppConfigInputSchema.safeParse({ docId: 'app', data: { appVersion: '1.0.1' } }).success).toBe(true);
  });

  it('carries no public-document version block — that is absent until the first release', () => {
    expect('publicDocumentVersions' in DEFAULT_APP_CONFIG).toBe(false);
  });

  it('is exported from the package root and the utils subpath', () => {
    expect(root.DEFAULT_APP_CONFIG).toBe(DEFAULT_APP_CONFIG);
    expect(utils.mergeAppConfigUpdate).toBe(mergeAppConfigUpdate);
  });
});

describe('DEFAULT_MAINTENANCE_MESSAGE — the line for a blank maintenance message', () => {
  it('is the one fallback line, exported beside DEFAULT_APP_CONFIG from the root and utils', () => {
    expect(DEFAULT_MAINTENANCE_MESSAGE).toBe(
      'TTT Productions is down for maintenance right now. We will be back shortly — thank you for your patience.',
    );
    expect(root.DEFAULT_MAINTENANCE_MESSAGE).toBe(DEFAULT_MAINTENANCE_MESSAGE);
    expect(utils.DEFAULT_MAINTENANCE_MESSAGE).toBe(DEFAULT_MAINTENANCE_MESSAGE);
  });

  it('is not the stored default — a blank stored message is what selects it', () => {
    expect(DEFAULT_APP_CONFIG.maintenanceMessage).toBe('');
  });

  it('is a message the doc itself could hold', () => {
    expect(DEFAULT_MAINTENANCE_MESSAGE.length).toBeLessThanOrEqual(MAX_MAINTENANCE_MESSAGE_LENGTH);
  });
});

describe('mergeAppConfigUpdate — the one rule for writing _appConfig/app', () => {
  it('a bare merge-write onto a missing doc leaves it unparseable — the defect this closes', () => {
    expect(AppConfigSchema.safeParse({ publicDocumentVersions: block }).success).toBe(false);
    expect(AppConfigSchema.safeParse({ maintenanceMode: true }).success).toBe(false);
  });

  it('a release publish onto a missing doc writes a complete, valid doc', () => {
    const doc = mergeAppConfigUpdate(undefined, { publicDocumentVersions: block });
    expect(AppConfigSchema.safeParse(doc).success).toBe(true);
    expect(doc).toEqual({ ...DEFAULT_APP_CONFIG, publicDocumentVersions: block });
  });

  it('the admin card never sends appVersion, and still writes a complete doc onto a missing one', () => {
    const doc = mergeAppConfigUpdate(null, { maintenanceMode: true, maintenanceMessage: 'Back soon.' });
    expect(doc).toEqual({ ...DEFAULT_APP_CONFIG, maintenanceMode: true, maintenanceMessage: 'Back soon.' });
  });

  it('keeps every field already on the doc that the update does not name', () => {
    const existing = { appVersion: '1.4.2', maintenanceMode: false, registrationEnabled: false, publicDocumentVersions: block };
    const doc = mergeAppConfigUpdate(existing, { announcementMessage: 'Tonight at 9.' });
    expect(doc).toEqual({ ...DEFAULT_APP_CONFIG, ...existing, announcementMessage: 'Tonight at 9.' });
  });

  it('the update wins over the doc, and an undefined update field changes nothing', () => {
    const existing = { appVersion: '1.4.2', maintenanceMode: true, registrationEnabled: true };
    const doc = mergeAppConfigUpdate(existing, { appVersion: '1.4.3', maintenanceMode: undefined });
    expect(doc.appVersion).toBe('1.4.3');
    expect(doc.maintenanceMode).toBe(true);
  });

  it('heals a doc an earlier bare merge left without its required fields', () => {
    const doc = mergeAppConfigUpdate({ publicDocumentVersions: block }, { registrationEnabled: false });
    expect(doc).toEqual({ ...DEFAULT_APP_CONFIG, registrationEnabled: false, publicDocumentVersions: block });
  });

  it('refuses an invalid update, naming the field', () => {
    expect(() => mergeAppConfigUpdate(undefined, { rateLimitMultiplier: 2 })).toThrow(/rateLimitMultiplier/);
  });

  it('refuses rather than writes over an invalid field already on the doc', () => {
    expect(() => mergeAppConfigUpdate({ appVersion: 7 }, { maintenanceMode: true })).toThrow(/appVersion/);
  });

  it('writes a maintenance message up to its cap, and refuses one over it', () => {
    const atCap = 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH);
    expect(mergeAppConfigUpdate(undefined, { maintenanceMode: true, maintenanceMessage: atCap }).maintenanceMessage).toBe(atCap);
    expect(() => mergeAppConfigUpdate(undefined, { maintenanceMessage: `${atCap}m` })).toThrow(/maintenanceMessage/);
  });

  it('refuses rather than writes over an over-cap text lever already on the doc', () => {
    const overCapVersion = '1'.repeat(MAX_APP_VERSION_LENGTH + 1);
    expect(() => mergeAppConfigUpdate({ appVersion: overCapVersion }, { registrationEnabled: false })).toThrow(/appVersion/);
    const overCapMessage = 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1);
    expect(() => mergeAppConfigUpdate({ maintenanceMessage: overCapMessage }, { maintenanceMode: false })).toThrow(/maintenanceMessage/);
  });

  it('never mutates the default or its inputs', () => {
    const existing = { appVersion: '1.0.0' };
    const update = { maintenanceMode: true };
    mergeAppConfigUpdate(existing, update);
    expect(existing).toEqual({ appVersion: '1.0.0' });
    expect(update).toEqual({ maintenanceMode: true });
    expect(DEFAULT_APP_CONFIG.maintenanceMode).toBe(false);
  });
});

describe('readAppConfigLever — the one rule for reading a lever off the untrusted stored doc', () => {
  const stored = {
    appVersion: '2.1.0',
    maintenanceMode: true,
    maintenanceMessage: 'Back at noon.',
    registrationEnabled: false,
    announcementMessage: 'Tonight at 9.',
    rateLimitMultiplier: 0.5,
    publicDocumentVersions: block,
  };

  it('passes a valid stored value through for every lever', () => {
    for (const lever of Object.keys(DEFAULT_APP_CONFIG) as AppConfigLeverKey[]) {
      expect(readAppConfigLever(stored, lever)).toBe(stored[lever]);
    }
  });

  it('reads an absent field as its default', () => {
    expect(readAppConfigLever({}, 'maintenanceMode')).toBe(false);
    expect(readAppConfigLever({ maintenanceMode: true }, 'maintenanceMessage')).toBe('');
    expect(readAppConfigLever({}, 'registrationEnabled')).toBe(true);
    expect(readAppConfigLever({}, 'rateLimitMultiplier')).toBe(1);
  });

  it('reads every lever off a null or undefined snapshot as its default', () => {
    for (const lever of Object.keys(DEFAULT_APP_CONFIG) as AppConfigLeverKey[]) {
      expect(readAppConfigLever(null, lever)).toBe(DEFAULT_APP_CONFIG[lever]);
      expect(readAppConfigLever(undefined, lever)).toBe(DEFAULT_APP_CONFIG[lever]);
    }
  });

  it.each<[string, AppConfigLeverKey, unknown]>([
    ['a number for the maintenance message', 'maintenanceMessage', 42],
    ['null for the maintenance message', 'maintenanceMessage', null],
    ['an over-cap maintenance message', 'maintenanceMessage', 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH + 1)],
    ['an over-cap announcement', 'announcementMessage', 'a'.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH + 1)],
    ['an over-cap app version', 'appVersion', '1'.repeat(MAX_APP_VERSION_LENGTH + 1)],
    ['a number for the app version', 'appVersion', 7],
    ['the string "true" for the kill switch', 'maintenanceMode', 'true'],
    ['a number for the intake gate', 'registrationEnabled', 0],
    ['a multiplier above 1', 'rateLimitMultiplier', 2],
    ['a zero multiplier', 'rateLimitMultiplier', 0],
    ['a negative multiplier', 'rateLimitMultiplier', -0.5],
    ['a NaN multiplier', 'rateLimitMultiplier', Number.NaN],
    ['a string multiplier', 'rateLimitMultiplier', '0.5'],
  ])('reads %s as the default', (_label, lever, junk) => {
    expect(readAppConfigLever({ [lever]: junk }, lever)).toBe(DEFAULT_APP_CONFIG[lever]);
  });

  it('reads a maintenance message and an announcement at their caps as stored', () => {
    const message = 'm'.repeat(MAX_MAINTENANCE_MESSAGE_LENGTH);
    const announcement = 'a'.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH);
    expect(readAppConfigLever({ maintenanceMessage: message }, 'maintenanceMessage')).toBe(message);
    expect(readAppConfigLever({ announcementMessage: announcement }, 'announcementMessage')).toBe(announcement);
  });

  it('is exported from the package root and the utils subpath', () => {
    expect(root.readAppConfigLever).toBe(readAppConfigLever);
    expect(utils.readAppConfigLever).toBe(readAppConfigLever);
  });
});

describe('readAppConfigLevers — every lever through the one read rule', () => {
  it('reads a null or undefined snapshot as DEFAULT_APP_CONFIG: the open posture', () => {
    expect(readAppConfigLevers(null)).toEqual(DEFAULT_APP_CONFIG);
    expect(readAppConfigLevers(undefined)).toEqual(DEFAULT_APP_CONFIG);
    expect(readAppConfigLevers({})).toEqual(DEFAULT_APP_CONFIG);
  });

  it('keeps every valid field and defaults only the one the schema refuses', () => {
    const levers = readAppConfigLevers({
      appVersion: '2.1.0',
      maintenanceMode: true,
      maintenanceMessage: 42,
      registrationEnabled: false,
      announcementMessage: 'Tonight at 9.',
      rateLimitMultiplier: 5,
    });
    expect(levers).toEqual({
      appVersion: '2.1.0',
      maintenanceMode: true,
      maintenanceMessage: '',
      registrationEnabled: false,
      announcementMessage: 'Tonight at 9.',
      rateLimitMultiplier: 1,
    });
    // The defect this closes: a console-edited number here made the shell's `.trim()` throw.
    expect(() => levers.maintenanceMessage.trim()).not.toThrow();
  });

  it('carries no field but the levers — not the version block, not a stray console field', () => {
    const levers = readAppConfigLevers({ publicDocumentVersions: block, strayField: 'x' });
    expect(Object.keys(levers).sort()).toEqual(Object.keys(DEFAULT_APP_CONFIG).sort());
  });

  it.each<[string, unknown]>([
    ['a number', 5],
    ['a string', 'maintenance'],
    ['a boolean', true],
    ['an array', [true, 'x']],
    ['a function', () => ({ maintenanceMode: true })],
    ['a nested junk object', { maintenanceMode: { on: true }, maintenanceMessage: ['x'], rateLimitMultiplier: {} }],
    ['an object with no prototype', Object.create(null)],
  ])('never throws on %s, and answers only schema-valid levers', (_label, junk) => {
    let levers: ReturnType<typeof readAppConfigLevers> | undefined;
    expect(() => {
      levers = readAppConfigLevers(junk as Record<string, unknown>);
    }).not.toThrow();
    expect(levers).toEqual(DEFAULT_APP_CONFIG);
  });

  it('never mutates the default or the snapshot', () => {
    const snapshot = { maintenanceMode: true, maintenanceMessage: 7 };
    const levers = readAppConfigLevers(snapshot);
    expect(snapshot).toEqual({ maintenanceMode: true, maintenanceMessage: 7 });
    expect(levers).not.toBe(DEFAULT_APP_CONFIG);
    expect(DEFAULT_APP_CONFIG.maintenanceMode).toBe(false);
  });

  it('is exported from the package root and the utils subpath', () => {
    expect(root.readAppConfigLevers).toBe(readAppConfigLevers);
    expect(utils.readAppConfigLevers).toBe(readAppConfigLevers);
  });
});
