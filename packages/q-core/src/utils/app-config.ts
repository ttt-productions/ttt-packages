import { AppConfigSchema } from '../doc-schemas/system.js';
import type { AppConfig } from '../doc-schemas/system.js';
import { PATH_BUILDERS } from '../paths/path-builders.js';
import { toPath } from '../paths/utils.js';

export type AppConfigLevers = Readonly<AppConfig>;

export type AppConfigLeverKey = keyof AppConfigLevers;

export const APP_CONFIG_LEVER_KEYS = AppConfigSchema.keyof().options;

export const STANDARD_MAINTENANCE_MESSAGE =
  'Q-Sports is down for maintenance right now. We will be back shortly — thank you for your patience.';

export type AppConfigProblem = 'missing-document' | 'invalid-setting';

const APP_CONFIG_PATH = toPath(PATH_BUILDERS.appConfig());

export class AppConfigInvalidError extends Error {
  readonly problem: AppConfigProblem;
  readonly setting: string | undefined;

  constructor(problem: AppConfigProblem, setting?: string, detail?: string) {
    super(
      problem === 'missing-document'
        ? `${APP_CONFIG_PATH} does not exist.`
        : `${APP_CONFIG_PATH}.${setting ?? '(document)'} is missing or does not match its schema (${detail ?? 'invalid'}).`,
    );
    this.name = 'AppConfigInvalidError';
    this.problem = problem;
    this.setting = setting;
  }
}

export function readAppConfigLevers(
  stored: Readonly<Record<string, unknown>> | null | undefined,
): AppConfigLevers {
  if (stored === null || stored === undefined) {
    throw new AppConfigInvalidError('missing-document');
  }
  const parsed = AppConfigSchema.safeParse(stored);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const setting = issue?.path.map(String).join('.') || undefined;
    throw new AppConfigInvalidError('invalid-setting', setting, issue?.message);
  }
  return parsed.data;
}

export function readAppConfigLever<L extends AppConfigLeverKey>(
  stored: Readonly<Record<string, unknown>> | null | undefined,
  lever: L,
): AppConfigLevers[L] {
  return readAppConfigLevers(stored)[lever];
}

export function isMaintenanceOn(levers: Pick<AppConfigLevers, 'maintenanceMessage'>): boolean {
  return levers.maintenanceMessage !== '';
}

export interface AppConfigMerge {
  readonly before: AppConfigLevers;
  readonly after: AppConfigLevers;
  readonly changes: Partial<AppConfigLevers>;
}

export function mergeAppConfigUpdate(
  stored: Readonly<Record<string, unknown>> | null | undefined,
  update: Readonly<Partial<AppConfig>>,
): AppConfigMerge {
  const before = readAppConfigLevers(stored);
  const changed = APP_CONFIG_LEVER_KEYS.filter((lever) => update[lever] !== undefined);
  const sent = Object.fromEntries(changed.map((lever) => [lever, update[lever]]));
  const parsed = AppConfigSchema.safeParse({ ...before, ...sent });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'document';
    throw new Error(
      `${APP_CONFIG_PATH} would not match its schema after this update (${field}: ${issue?.message ?? 'invalid'}). Nothing should be written.`,
    );
  }
  const after = parsed.data;
  const changes = Object.fromEntries(
    changed.map((lever) => [lever, after[lever]]),
  ) as Partial<AppConfigLevers>;
  return { before, after, changes };
}
