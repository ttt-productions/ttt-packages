import type { z } from 'zod';
import { AppConfigInvalidError } from './app-config-invalid-error.js';
import type { AppConfigProblem } from './app-config-invalid-error.js';

export type AppConfigSettingsSchema = z.ZodObject;

export type StoredAppConfigData = Readonly<Record<string, unknown>> | null | undefined;

export type AppConfigSettingKey<Settings extends object> = keyof Settings & string;

export interface AppConfigMerge<Settings extends object> {
  readonly before: Readonly<Settings>;
  readonly after: Readonly<Settings>;
  readonly changes: Readonly<Partial<Settings>>;
}

export interface AppConfigDefinition<Settings extends object> {
  readonly path: string;
  readonly settings: readonly AppConfigSettingKey<Settings>[];
  readonly read: (stored: StoredAppConfigData) => Readonly<Settings>;
  readonly merge: (
    stored: StoredAppConfigData,
    update: Readonly<Partial<Settings>>,
  ) => AppConfigMerge<Settings>;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function definedKeys(record: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(record).filter((key) => record[key] !== undefined);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    const rightItems: readonly unknown[] = right;
    return left.every((item: unknown, index) => sameValue(item, rightItems[index]));
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const leftKeys = definedKeys(left);
  return (
    leftKeys.length === definedKeys(right).length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
  );
}

export function defineAppConfig<Schema extends AppConfigSettingsSchema>(definition: {
  path: string;
  schema: Schema;
}): AppConfigDefinition<z.output<Schema>> {
  type Settings = z.output<Schema>;
  const { path, schema } = definition;
  const settings = Object.freeze(
    Object.keys(schema.shape),
  ) as readonly AppConfigSettingKey<Settings>[];

  const storedSettings = (stored: StoredAppConfigData): Record<string, unknown> => {
    if (stored === null || stored === undefined) {
      throw new AppConfigInvalidError(path, 'missing-document');
    }
    return Object.fromEntries(
      settings.filter((key) => Object.hasOwn(stored, key)).map((key) => [key, stored[key]]),
    );
  };

  const parseSettings = (problem: AppConfigProblem, raw: Record<string, unknown>): Settings => {
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    const issue = parsed.error.issues[0];
    const [setting, ...within] = issue?.path ?? [];
    const message = issue?.message ?? 'invalid';
    throw new AppConfigInvalidError(
      path,
      problem,
      setting === undefined ? undefined : String(setting),
      within.length > 0 ? `${within.map(String).join('.')}: ${message}` : message,
    );
  };

  const read = (stored: StoredAppConfigData): Readonly<Settings> =>
    parseSettings('invalid-setting', storedSettings(stored));

  const merge = (
    stored: StoredAppConfigData,
    update: Readonly<Partial<Settings>>,
  ): AppConfigMerge<Settings> => {
    const raw = storedSettings(stored);
    const before = parseSettings('invalid-setting', raw);
    const sent: Record<string, unknown> = {};
    for (const key of settings) {
      if (update[key] !== undefined) sent[key] = update[key];
    }
    const after = parseSettings('invalid-update', { ...raw, ...sent });
    const changes: Partial<Settings> = {};
    for (const key of settings) {
      if (!sameValue(before[key], after[key])) changes[key] = after[key];
    }
    return { before, after, changes };
  };

  return Object.freeze({ path, settings, read, merge });
}
