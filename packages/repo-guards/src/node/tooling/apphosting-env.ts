// The App Hosting BUILD environment, derived from the same committed `apphosting*.yaml` files App
// Hosting reads, so a CI parity build carries exactly the build inputs the real rollout bakes into
// the bundle — never a second copy of the values in workflow YAML.
//
// Merge semantics mirror App Hosting: production reads the base file AND its overlay, and the
// overlay wins per keyed variable.
//
// Fails closed: a BUILD-available `secret:` reference cannot be resolved in CI, so its presence is
// an error, not a silently missing build input. The only exceptions are the app's named skips, each
// justified as absence-non-fatal.

import { parse as parseYaml } from 'yaml';

export const BASE_CONFIG = 'apphosting.yaml';
export const PRODUCTION_CONFIG = 'apphosting.production.yaml';

export class AppHostingConfigError extends Error {}

/** A BUILD secret the parity build may proceed without, and why its absence changes nothing. */
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

/** App Hosting's default when `availability` is omitted is BUILD + RUNTIME. */
export function isBuildAvailable(entry: AppHostingEnvEntry): boolean {
  if (entry.availability === undefined || entry.availability === null) return true;
  if (!Array.isArray(entry.availability)) {
    throw new AppHostingConfigError(`${entry.variable}: availability must be a list`);
  }
  return entry.availability.includes('BUILD');
}

/**
 * One config file's `env` entries. A duplicate `variable` inside one file is an error: the keyed
 * merge applies BETWEEN the base and the overlay, and an ambiguous duplicate has no winner.
 */
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

/** Keyed merge: an overlay entry REPLACES the base entry of the same variable, order kept. */
export function mergeEnv(
  baseEntries: readonly AppHostingEnvEntry[],
  overlayEntries: readonly AppHostingEnvEntry[],
): AppHostingEnvEntry[] {
  const merged = new Map<string, AppHostingEnvEntry>();
  for (const entry of baseEntries) merged.set(entry.variable, entry);
  for (const entry of overlayEntries) merged.set(entry.variable, entry);
  return [...merged.values()];
}

/**
 * The BUILD-available environment from the ordered config files (`[base]` for develop,
 * `[base, overlay]` for production). RUNTIME-only entries are left out. Throws when any
 * BUILD-available entry is a secret reference not in `skips`.
 */
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

/** The config files an environment reads, in merge order. */
export function configFilesFor(environment: string): string[] {
  if (environment === 'develop' || environment === 'development') return [BASE_CONFIG];
  if (environment === 'production') return [BASE_CONFIG, PRODUCTION_CONFIG];
  throw new AppHostingConfigError(
    `unknown environment '${environment}' (expected 'develop' or 'production')`,
  );
}
