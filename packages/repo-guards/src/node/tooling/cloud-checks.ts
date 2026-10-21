// The release's post-deploy steps against a real project, each failing CLOSED: a list or policy it
// cannot read blocks the job rather than passing a check that read nothing. Every one refuses a
// project its repository's `.firebaserc` does not declare.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CALLABLE_LABEL_FILTER,
  assessInvokers,
  lines,
  type IamPolicy,
} from './callable-invokers.js';
import {
  compareDeployedFunctions,
  parseLiveFunctions,
  type ExpectedCodebase,
} from './deployed-functions.js';
import {
  assertSafeCors,
  defaultStorageBucket,
  normalizeCors,
  readBucketCors,
} from './storage-cors.js';
import { readFirebaseProjects } from './firebase-projects-file.js';

function gcloud(args: readonly string[], cwd?: string): string {
  return execFileSync('gcloud', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function firstLine(error: unknown): string {
  const e = error as { stderr?: unknown; message?: unknown } | null;
  return String(e?.stderr || e?.message || error).split('\n')[0]!;
}

function knownProject(repoRoot: string, projectId: string | undefined, tag: string): string {
  const projects = readFirebaseProjects(repoRoot);
  const known = [projects.dev, projects.prod];
  if (!projectId) {
    console.error(`usage: <script> <projectId>  (one of: ${known.join(', ')})`);
    process.exit(2);
  }
  if (!known.includes(projectId)) {
    console.error(
      `::error::[${tag}] Unknown project "${projectId}" — expected one of: ${known.join(', ')}.`,
    );
    process.exit(2);
  }
  return projectId;
}

/**
 * Apply the checked-in `cors.json` to the project's default Storage bucket, read the bucket's
 * policy back, and throw unless it is exactly that policy.
 */
export function applyStorageCors(repoRoot: string, projectId: string): void {
  const projects = readFirebaseProjects(repoRoot);
  if (projectId !== projects.dev && projectId !== projects.prod) {
    throw new Error(`unsupported project: ${projectId}`);
  }
  const expected: unknown = JSON.parse(readFileSync(path.join(repoRoot, 'cors.json'), 'utf8'));
  assertSafeCors(expected);
  const bucketUri = `gs://${defaultStorageBucket(projectId)}`;
  gcloud(
    ['storage', 'buckets', 'update', bucketUri, '--cors-file=cors.json', `--project=${projectId}`],
    repoRoot,
  );
  const actual = readBucketCors(
    JSON.parse(
      gcloud(
        ['storage', 'buckets', 'describe', bucketUri, '--format=json', `--project=${projectId}`],
        repoRoot,
      ),
    ),
  );
  if (JSON.stringify(normalizeCors(actual)) !== JSON.stringify(normalizeCors(expected))) {
    throw new Error(
      `Storage CORS verification failed for ${bucketUri}: applied ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  }
  console.log(`Storage CORS applied and verified for ${bucketUri}`);
}

/**
 * Every labelled callable service, plus the app's public webhook services, must bind `allUsers`
 * to `roles/run.invoker`.
 */
export function checkCallableInvokers({
  repoRoot,
  region,
  projectId: requested,
  extraPublicServices = [],
}: {
  repoRoot: string;
  region: string;
  projectId: string | undefined;
  /** Public `onRequest` services the callable label does not mark, named as Cloud Run names them. */
  extraPublicServices?: readonly string[];
}): void {
  const projectId = knownProject(repoRoot, requested, 'invoker-guard');
  let labelled: string[];
  try {
    labelled = lines(
      gcloud([
        'run',
        'services',
        'list',
        `--project=${projectId}`,
        `--region=${region}`,
        `--filter=${CALLABLE_LABEL_FILTER}`,
        '--format=value(metadata.name)',
      ]),
    );
  } catch (error) {
    console.error(
      `::error::[invoker-guard] Could not list Cloud Run services on ${projectId} (${firstLine(error)}). The guard fails CLOSED; if this is a permissions error, grant the deploy service account roles/run.viewer.`,
    );
    process.exit(1);
  }
  if (labelled.length === 0) {
    console.error(
      `::error::[invoker-guard] No callable service carries the ${CALLABLE_LABEL_FILTER} label on ${projectId} in ${region}. The guard fails CLOSED: a check that found nothing proved nothing.`,
    );
    process.exit(1);
  }
  const services = [...new Set([...labelled, ...extraPublicServices])];
  const policies = new Map<string, IamPolicy | Error>();
  for (const name of services) {
    try {
      policies.set(
        name,
        JSON.parse(
          gcloud([
            'run',
            'services',
            'get-iam-policy',
            name,
            `--project=${projectId}`,
            `--region=${region}`,
            '--format=json',
          ]) || '{}',
        ) as IamPolicy,
      );
    } catch (error) {
      policies.set(
        name,
        new Error(error instanceof SyntaxError ? 'unparseable IAM policy' : firstLine(error)),
      );
    }
  }
  const { missing, unreadable } = assessInvokers(services, policies);
  for (const name of missing) {
    console.error(
      `::error::[invoker-guard] ${name} is MISSING the allUsers -> roles/run.invoker binding — clients are refused at Cloud Run before the request reaches the function. Fix: gcloud run services add-iam-policy-binding ${name} --region=${region} --project=${projectId} --member=allUsers --role=roles/run.invoker`,
    );
  }
  for (const entry of unreadable) {
    console.error(
      `::error::[invoker-guard] Could not read the IAM policy for ${entry}. The guard fails CLOSED; grant the deploy service account roles/run.viewer if this is a permissions error.`,
    );
  }
  if (missing.length || unreadable.length) {
    console.error(
      `\n[invoker-guard] FAILED — ${missing.length} missing binding(s), ${unreadable.length} unreadable — on project ${projectId}.`,
    );
    process.exit(1);
  }
  console.log(
    `[invoker-guard] OK — ${services.length} public service(s) on ${projectId} carry the allUsers invoker binding.`,
  );
}

/**
 * The live functions must be exactly the expected ones, each ACTIVE.
 * `expected` answers the codebases this deploy targeted; an empty answer means the deploy
 * targeted no functions. It throws on input it cannot read, which fails the job.
 */
export function checkDeployedFunctions({
  repoRoot,
  region,
  projectId: requested,
  expected,
}: {
  repoRoot: string;
  region: string;
  projectId: string | undefined;
  expected: () => readonly ExpectedCodebase[];
}): void {
  const projectId = knownProject(repoRoot, requested, 'deployed-functions');
  let groups: readonly ExpectedCodebase[];
  try {
    groups = expected();
  } catch (error) {
    console.error(
      `::error::[deployed-functions] Could not read the expected functions (${firstLine(error)}). The guard fails CLOSED.`,
    );
    process.exit(2);
  }
  if (groups.length === 0) {
    console.log('[deployed-functions] OK — this deploy targeted no functions.');
    return;
  }
  let live;
  try {
    live = parseLiveFunctions(
      JSON.parse(
        gcloud([
          'functions',
          'list',
          `--project=${projectId}`,
          `--regions=${region}`,
          '--format=json',
        ]) || '[]',
      ),
    );
  } catch (error) {
    console.error(
      `::error::[deployed-functions] Could not list the functions on ${projectId} (${firstLine(error)}). The guard fails CLOSED.`,
    );
    process.exit(1);
  }
  const { missing, leftover, notActive } = compareDeployedFunctions(groups, live);
  for (const fn of missing) {
    console.error(
      `::error::[deployed-functions] ${fn} is expected but NOT deployed — its create was dropped or failed.`,
    );
  }
  for (const fn of leftover) {
    console.error(
      `::error::[deployed-functions] ${fn} is still deployed but no longer expected — its deletion did not happen.`,
    );
  }
  for (const fn of notActive) {
    console.error(`::error::[deployed-functions] ${fn} is deployed but not ACTIVE.`);
  }
  if (missing.length || leftover.length || notActive.length) {
    console.error(
      `\n[deployed-functions] FAILED on ${projectId} — ${missing.length} missing, ${leftover.length} leftover, ${notActive.length} not ACTIVE.`,
    );
    process.exit(1);
  }
  const count = groups.reduce((n, g) => n + g.names.length, 0);
  console.log(
    `[deployed-functions] OK — ${count} functions on ${projectId}: every expected function is live and ACTIVE, and nothing else is.`,
  );
}
