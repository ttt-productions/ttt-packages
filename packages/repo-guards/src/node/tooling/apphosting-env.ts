import { parse as parseYaml } from 'yaml';

export const BASE_CONFIG = 'apphosting.yaml';
export const PRODUCTION_CONFIG = 'apphosting.production.yaml';

export class AppHostingConfigError extends Error {}

export interface BuildSecretSkip {
  variable: string;
  why: string;
}

export interface AppHostingEnvEntry {
  variable: string;
  availability?: unknown;
  value?: unknown;
  secret?: unknown;
}

// App Hosting's default when `availability` is omitted is BUILD + RUNTIME.
export function isBuildAvailable(entry: AppHostingEnvEntry): boolean {
  if (entry.availability === undefined || entry.availability === null) return true;
  if (!Array.isArray(entry.availability)) {
    throw new AppHostingConfigError(`${entry.variable}: availability must be a list`);
  }
  return entry.availability.includes('BUILD');
}

export function parseConfig(text: string, label: string): AppHostingEnvEntry[] {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (error) {
    throw new AppHostingConfigError(
      `${label}: not valid YAML (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (doc === null || doc === undefined) return [];
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    throw new AppHostingConfigError(`${label}: top level must be a mapping`);
  }
  const env = (doc as { env?: unknown }).env;
  if (env === undefined || env === null) return [];
  if (!Array.isArray(env)) throw new AppHostingConfigError(`${label}: 'env' must be a list`);

  const seen = new Set<string>();
  return env.map((raw: unknown) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppHostingConfigError(`${label}: every 'env' entry must be a mapping`);
    }
    const { variable, value, secret, availability } = raw as Record<string, unknown>;
    if (typeof variable !== 'string' || variable === '') {
      throw new AppHostingConfigError(`${label}: an 'env' entry is missing 'variable'`);
    }
    if (seen.has(variable)) {
      throw new AppHostingConfigError(`${label}: duplicate 'variable' ${variable} within one file`);
    }
    seen.add(variable);
    const hasValue = value !== undefined;
    const hasSecret = secret !== undefined;
    if (hasValue === hasSecret) {
      throw new AppHostingConfigError(
        `${label}: ${variable} must declare exactly one of 'value' or 'secret'`,
      );
    }
    if (hasValue && (typeof value === 'object' || typeof value === 'function')) {
      throw new AppHostingConfigError(`${label}: ${variable} has a non-scalar 'value'`);
    }
    return { variable, availability, ...(hasValue ? { value } : { secret }) };
  });
}

// Mirrors App Hosting: an overlay entry replaces the base entry of the same variable.
export function mergeEnv(
  baseEntries: readonly AppHostingEnvEntry[],
  overlayEntries: readonly AppHostingEnvEntry[],
): AppHostingEnvEntry[] {
  const merged = new Map<string, AppHostingEnvEntry>();
  for (const entry of baseEntries) merged.set(entry.variable, entry);
  for (const entry of overlayEntries) merged.set(entry.variable, entry);
  return [...merged.values()];
}

export function buildEnvFromConfigs(
  configs: readonly { text: string; label: string }[],
  skips: readonly BuildSecretSkip[],
): Record<string, string> {
  const skipped = new Set(skips.map((skip) => skip.variable));
  const merged = configs.reduce<AppHostingEnvEntry[]>(
    (acc, cfg) => mergeEnv(acc, parseConfig(cfg.text, cfg.label)),
    [],
  );
  const env: Record<string, string> = {};
  const buildSecrets: string[] = [];
  for (const entry of merged) {
    if (!isBuildAvailable(entry)) continue;
    if (entry.secret !== undefined) {
      if (!skipped.has(entry.variable)) buildSecrets.push(entry.variable);
      continue;
    }
    env[entry.variable] = String(entry.value);
  }
  if (buildSecrets.length) {
    throw new AppHostingConfigError(
      `BUILD-available secret reference(s) cannot be resolved in CI: ${buildSecrets.join(', ')}. ` +
        'A build missing them is not environment parity — move them to RUNTIME availability or supply them explicitly.',
    );
  }
  return env;
}

export function configFilesFor(environment: string): string[] {
  if (environment === 'develop' || environment === 'development') return [BASE_CONFIG];
  if (environment === 'production') return [BASE_CONFIG, PRODUCTION_CONFIG];
  throw new AppHostingConfigError(
    `unknown environment '${environment}' (expected 'develop' or 'production')`,
  );
}
