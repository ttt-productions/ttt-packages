import { describe, it, expect } from 'vitest';
import {
  MAINTENANCE_REFUSAL_CODE,
  MAINTENANCE_REFUSAL_REASON,
  isMaintenanceRefusalDetails,
  isMaintenanceRefusalError,
} from '../src/utils/app-config.js';
import * as utils from '../src/utils/index.js';

describe('the maintenance refusal exports', () => {
  it('ship beside DEFAULT_MAINTENANCE_MESSAGE from the utils entry', () => {
    expect(utils.MAINTENANCE_REFUSAL_CODE).toBe(MAINTENANCE_REFUSAL_CODE);
    expect(utils.MAINTENANCE_REFUSAL_REASON).toBe(MAINTENANCE_REFUSAL_REASON);
    expect(utils.isMaintenanceRefusalDetails).toBe(isMaintenanceRefusalDetails);
    expect(utils.isMaintenanceRefusalError).toBe(isMaintenanceRefusalError);
  });
});
