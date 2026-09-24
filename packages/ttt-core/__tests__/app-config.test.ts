import { describe, it, expect } from 'vitest';
import { AppConfigSchema } from '../src/doc-schemas/system';
import { UpdateAppConfigInputSchema } from '../src/schemas/admin';
import { DEFAULT_APP_CONFIG, mergeAppConfigUpdate } from '../src/utils/app-config';
import { planPublicDocumentRelease } from '../src/utils/public-documents';
import { SPECIAL_DOCS } from '../src/paths/collections';
import { MAX_APP_VERSION_LENGTH, MAX_MAINTENANCE_MESSAGE_LENGTH } from '../src/constants/business-admin';
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
