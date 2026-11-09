import { MAINTENANCE_REFUSAL_CODE, MAINTENANCE_REFUSAL_REASON } from '../maintenance.js';
import { AuthAssertionError } from './authError.js';
import type { MaintenanceCheckFn, MaintenanceGateConfig } from './types.js';

export function createMaintenanceCheck(config: MaintenanceGateConfig): MaintenanceCheckFn {
  return async function assertNotInMaintenance(caller) {
    const state = await config.read();
    if (!state.on) return;
    if (caller !== undefined && (await config.isAdmin(caller.uid, caller.token))) return;
    throw new AuthAssertionError(MAINTENANCE_REFUSAL_CODE, state.message, {
      reason: MAINTENANCE_REFUSAL_REASON,
    });
  };
}
