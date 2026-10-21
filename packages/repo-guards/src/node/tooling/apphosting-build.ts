// The environment-parity production build: derive the App Hosting BUILD environment for
// `--environment <develop|production>` and run `npm run build` with it, or with `--print-only`
// stop after the derivation (it fails closed exactly as the build would, without compiling).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AppHostingConfigError,
  buildEnvFromConfigs,
  configFilesFor,
  type BuildSecretSkip,
} from './apphosting-env.js';
import { runNpmScript } from './shell.js';

export function runAppHostingBuild({
  repoRoot,
  skips,
  argv = process.argv.slice(2),
}: {
  repoRoot: string;
  skips: readonly BuildSecretSkip[];
  argv?: readonly string[];
}): void {
  const at = argv.indexOf('--environment');
  const environment = (at !== -1 ? (argv[at + 1] ?? '') : '').trim();
  let env: Record<string, string>;
  try {
    const configs = configFilesFor(environment).map((rel) => {
      const abs = path.join(repoRoot, rel);
      if (!existsSync(abs)) throw new AppHostingConfigError(`${rel}: not found`);
      return { label: rel, text: readFileSync(abs, 'utf8') };
    });
    env = buildEnvFromConfigs(configs, skips);
  } catch (error) {
    if (error instanceof AppHostingConfigError) {
      console.error(`::error::apphosting-build-env: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  // NAMES only: a build-time value is not a secret, but the export step never prints values.
  console.log(
    `apphosting-build-env: ${environment} exports ${Object.keys(env).length} BUILD variable(s): ${Object.keys(env).sort().join(', ')}`,
  );
  if (argv.includes('--print-only')) return;
  process.exit(runNpmScript('build', { cwd: repoRoot, env: { ...process.env, ...env } }));
}
