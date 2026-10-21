// `dev:login`: force a FRESH login on every operator CLI, one at a time.
//
// Always forces. A credential that still passes a validity check can expire minutes later, in the
// middle of a long run (a Workspace re-auth policy ends the gcloud and ADC sessions on a schedule:
// `invalid_grant … invalid_rapt`), so before a long operation the question is "is it new?", never
// "is it still valid?", and nothing is skipped.
//
// Each step is interactive (a browser opens) and the next starts only after the previous exits. A
// failed step stops the chain. Tokens are never printed. After the logins, gcloud's active project
// and the ADC quota project are pointed at the app's dev project: a fresh gcloud login keeps
// whatever project was active before (another product's, on a shared machine).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface LoginStep {
  name: string;
  command: string;
  cwd: string;
}

export interface DevLoginPlan {
  logins: readonly LoginStep[];
  projectSetup: readonly LoginStep[];
  summary: readonly LoginStep[];
  devProjectId: string;
}

/**
 * The plan for an app: the Firebase CLI, gcloud, and ADC logins, then any `extraLogins` (another
 * provider's CLI), the project setup, and the identity summary. firebase-tools is a GLOBAL install
 * that Git Bash's PATH may not reach, so it runs through npx, which resolves the global install
 * without downloading anything.
 */
export function devLoginPlan({
  repoRoot,
  devProjectId,
  extraLogins = [],
  extraSummary = [],
}: {
  repoRoot: string;
  devProjectId: string;
  extraLogins?: readonly LoginStep[];
  extraSummary?: readonly LoginStep[];
}): DevLoginPlan {
  return {
    devProjectId,
    logins: [
      { name: 'Firebase CLI', command: 'npx firebase login --reauth', cwd: repoRoot },
      { name: 'gcloud CLI', command: 'gcloud auth login --force', cwd: repoRoot },
      {
        name: 'gcloud Application Default Credentials',
        command: 'gcloud auth application-default login',
        cwd: repoRoot,
      },
      ...extraLogins,
    ],
    projectSetup: [
      {
        name: 'gcloud active project',
        command: `gcloud config set project ${devProjectId}`,
        cwd: repoRoot,
      },
      {
        name: 'ADC quota project',
        command: `gcloud auth application-default set-quota-project ${devProjectId}`,
        cwd: repoRoot,
      },
    ],
    summary: [
      { name: 'Firebase CLI account', command: 'npx firebase login:list', cwd: repoRoot },
      { name: 'gcloud account', command: 'gcloud auth list', cwd: repoRoot },
      { name: 'gcloud active project', command: 'gcloud config get-value project', cwd: repoRoot },
      ...extraSummary,
    ],
  };
}

/** Where gcloud keeps the signed-in user's Application Default Credentials, Windows first. */
export function adcCandidatePaths(
  env: Readonly<Record<string, string | undefined>> = process.env,
  home: string = homedir(),
): string[] {
  const paths: string[] = [];
  if (env.APPDATA)
    paths.push(path.join(env.APPDATA, 'gcloud', 'application_default_credentials.json'));
  paths.push(path.join(home, '.config', 'gcloud', 'application_default_credentials.json'));
  return paths;
}

/**
 * Every login, then the project setup, then the identity summary, each step through `runStep`
 * (which returns its exit status). A failed login or setup step stops the chain and its status is
 * returned; 0 means everything ran.
 */
export function runDevLogin(plan: DevLoginPlan, runStep: (step: LoginStep) => number): number {
  for (const [index, step] of plan.logins.entries()) {
    console.log(`\n──── ${index + 1} of ${plan.logins.length} — ${step.name} ────\n`);
    const status = runStep(step);
    if (status !== 0) {
      console.error(
        `\n  STOPPED: ${step.name} login exited ${status}. Later logins were NOT attempted.`,
      );
      console.error('  Fix that one, then run `npm run dev:login` again.\n');
      return status;
    }
  }
  for (const step of plan.projectSetup) {
    console.log(`\n──── ${step.name} → ${plan.devProjectId} ────\n`);
    const status = runStep(step);
    if (status !== 0) {
      console.error(`\n  STOPPED: setting the ${step.name} exited ${status}.\n`);
      return status;
    }
  }
  console.log('\n──── identity summary ────\n');
  for (const check of plan.summary) {
    console.log(`  ${check.name}:`);
    runStep(check);
    console.log('');
  }
  return 0;
}

/** Print the plan, then (unless `--dry-run`) run it with the operator's terminal attached. */
export function runDevLoginCli(
  plan: DevLoginPlan,
  argv: readonly string[] = process.argv.slice(2),
): void {
  console.log('\ndev:login — forcing a fresh login on every operator CLI, one at a time.\n');
  plan.logins.forEach((step, index) =>
    console.log(`  ${index + 1}. ${step.name}\n       ${step.command}`),
  );
  plan.projectSetup.forEach((step) => console.log(`  then: ${step.name}\n       ${step.command}`));
  if (argv.includes('--dry-run')) {
    console.log('\n  --dry-run: nothing was run.\n');
    return;
  }
  // A shell so the CLIs' .cmd shims resolve on Windows; inherited stdio so browser prompts and
  // verification codes reach the operator directly.
  const status = runDevLogin(
    plan,
    ({ command, cwd }) => spawnSync(command, { cwd, stdio: 'inherit', shell: true }).status ?? 1,
  );
  if (status !== 0) process.exit(status);
  const adc = adcCandidatePaths().find((candidate) => existsSync(candidate));
  if (adc) {
    const parsed = JSON.parse(readFileSync(adc, 'utf8')) as {
      type?: string;
      quota_project_id?: string;
    };
    console.log(`  ADC: type ${parsed.type}, quota_project ${parsed.quota_project_id ?? '(none)'}`);
  } else {
    console.log(
      '  ADC: MISSING — the operator scripts authenticate through ADC, so this is a stop',
    );
  }
  console.log(`\n  All ${plan.logins.length} logins are fresh.\n`);
}
