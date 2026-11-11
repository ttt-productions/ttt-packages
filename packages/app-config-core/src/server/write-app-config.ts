import type { ServerDocRef } from '@ttt-productions/firebase-helpers/server';
import type {
  AppConfigDefinition,
  AppConfigSettingKey,
  StoredAppConfigData,
} from '../app-config-definition.js';

export interface AppConfigWriter {
  update(ref: ServerDocRef, data: Record<string, unknown>): unknown;
}

export interface AppConfigWriteRequest<Settings extends object> {
  ref: ServerDocRef;
  definition: AppConfigDefinition<Settings>;
  stored: StoredAppConfigData;
  update: Readonly<Partial<Settings>>;
}

export type AppConfigSettingChanges<Settings extends object> = {
  readonly [Key in AppConfigSettingKey<Settings>]?: {
    readonly before: Settings[Key];
    readonly after: Settings[Key];
  };
};

export interface AppConfigWrite<Settings extends object> {
  readonly updatedSettings: readonly AppConfigSettingKey<Settings>[];
  readonly changes: AppConfigSettingChanges<Settings>;
}

export function writeAppConfig<Settings extends object>(
  writer: AppConfigWriter,
  request: AppConfigWriteRequest<Settings>,
): AppConfigWrite<Settings> {
  const { definition } = request;
  const { before, after, changes } = definition.merge(request.stored, request.update);
  const updatedSettings = definition.settings.filter((key) => Object.hasOwn(changes, key));
  if (updatedSettings.length === 0) return { updatedSettings, changes: {} };

  const written: Record<string, unknown> = {};
  const audited: {
    [Key in AppConfigSettingKey<Settings>]?: { before: Settings[Key]; after: Settings[Key] };
  } = {};
  for (const key of updatedSettings) {
    written[key] = changes[key];
    audited[key] = { before: before[key], after: after[key] };
  }
  writer.update(request.ref, written);
  return { updatedSettings, changes: audited };
}
