import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_MAINTENANCE_MESSAGE,
  mergeAppConfigUpdate,
  readAppConfigLever,
  readAppConfigLevers,
} from '../src/utils/app-config';
import * as utils from '../src/utils';

describe('DEFAULT_APP_CONFIG — _appConfig/app at rest', () => {
  it('is exported from the utils entry', () => {
    expect(utils.DEFAULT_APP_CONFIG).toBe(DEFAULT_APP_CONFIG);
    expect(utils.mergeAppConfigUpdate).toBe(mergeAppConfigUpdate);
  });
});

describe('DEFAULT_MAINTENANCE_MESSAGE — the line for a blank maintenance message', () => {
  it('is the one fallback line, exported beside DEFAULT_APP_CONFIG from the utils entry', () => {
    expect(DEFAULT_MAINTENANCE_MESSAGE).toBe(
      'TTT Productions is down for maintenance right now. We will be back shortly — thank you for your patience.',
    );
    expect(utils.DEFAULT_MAINTENANCE_MESSAGE).toBe(DEFAULT_MAINTENANCE_MESSAGE);
  });
});

describe('readAppConfigLever — the one rule for reading a lever off the untrusted stored doc', () => {
  it('is exported from the utils entry', () => {
    expect(utils.readAppConfigLever).toBe(readAppConfigLever);
  });
});

describe('readAppConfigLevers — every lever through the one read rule', () => {
  it('is exported from the utils entry', () => {
    expect(utils.readAppConfigLevers).toBe(readAppConfigLevers);
  });
});
