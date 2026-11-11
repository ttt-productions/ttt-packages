import { defineAppConfig } from '@ttt-productions/app-config-core';
import { AppConfigSchema } from '../doc-schemas/system.js';
import type { AppConfig } from '../doc-schemas/system.js';
import { PATH_BUILDERS } from '../paths/path-builders.js';
import { toPath } from '../paths/utils.js';

export const APP_CONFIG_DEFINITION = defineAppConfig({
  path: toPath(PATH_BUILDERS.appConfig()),
  schema: AppConfigSchema,
});

export const STANDARD_MAINTENANCE_MESSAGE =
  'Q-Sports is down for maintenance right now. We will be back shortly — thank you for your patience.';

export function isMaintenanceOn(settings: Pick<AppConfig, 'maintenanceMessage'>): boolean {
  return settings.maintenanceMessage !== '';
}
