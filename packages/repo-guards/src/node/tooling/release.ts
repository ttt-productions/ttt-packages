import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import {
  DispatchInputError,
  formatOutputs,
  lastGreenRunsUrl,
  pickNewestGreenSha,
  resolveReleaseScope,
  type ReleaseApi,
  type ReleaseDispatch,
  type ReleaseGit,
  type ReleaseScopeConfig,
} from './release-scope.js';
import {
  assertReleaseVerdict,
  assertVerificationGate,
  renderSummary,
  type ReleaseVerdictConfig,
} from './release-verdict.js';

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

export function repoGit(repoRoot: string): ReleaseGit {
  const run = (...args: string[]): string =>
    execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return {
    commitExists(sha) {
      try {
        run('cat-file', '-e', `${sha}^{commit}`);
        return true;
      } catch {
        return false;
      }
    },
    isAncestor(a, b) {
      try {
        run('merge-base', '--is-ancestor', a, b);
        return true;
      } catch {
        return false;
      }
    },
    changedFiles(base, head) {
      return run('diff', '--name-only', base, head).split('\n').filter(Boolean);
    },
  };
}

export function githubReleaseApi({
  repo,
  branch,
  runId,
  token,
  workflowFile,
}: {
  repo: string;
  branch: string;
  runId: string;
  token: string;
  workflowFile: string;
}): ReleaseApi {
  const request = async (url: string): Promise<unknown> => {
    const res = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
    return res.json();
  };
  return {
    async branchTip() {
      const body = (await request(
        `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
      )) as { object?: { sha?: string } } | null;
      return body?.object?.sha ?? null;
    },
    async latestGreenPushSha() {
      const body = (await request(lastGreenRunsUrl(repo, branch, workflowFile))) as {
        workflow_runs?: { id: number; head_sha: string }[];
      } | null;
      return pickNewestGreenSha(body?.workflow_runs, runId);
    },
  };
}

export async function runReleaseScopeCli(
  config: ReleaseScopeConfig,
  {
    repoRoot,
    workflowFile,
    codebaseNames = [],
    argv = process.argv.slice(2),
  }: {
    repoRoot: string;
    workflowFile: string;
    codebaseNames?: readonly string[];
    argv?: readonly string[];
  },
): Promise<void> {
  const bool = (name: string): boolean => String(argOf(argv, name) ?? '').trim() === 'true';
  const dispatch: ReleaseDispatch = { full_fleet: bool('--dispatch-full-fleet') };
  for (const component of config.components) {
    if (component.dispatchByCodebases) dispatch.codebases = argOf(argv, '--dispatch-codebases');
    else dispatch[component.key] = bool(`--dispatch-${component.key.replaceAll('_', '-')}`);
  }

  let resolved;
  try {
    resolved = await resolveReleaseScope(config, {
      event: argOf(argv, '--event') || 'push',
      headSha: (argOf(argv, '--head-sha') || '').trim(),
      codebaseNames,
      dispatch,
      api: githubReleaseApi({
        repo: argOf(argv, '--repo') || '',
        branch: argOf(argv, '--branch') || '',
        runId: argOf(argv, '--run-id') || '',
        token: process.env.GITHUB_TOKEN || '',
        workflowFile,
      }),
      git: repoGit(repoRoot),
    });
  } catch (error) {
    if (error instanceof DispatchInputError) {
      console.error(`::error::Invalid 'codebases' input: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const outputs = formatOutputs(config, resolved);
  console.log(`release-scope:\n${outputs}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs}\n`);
}

export function runReleaseVerdictCli(
  config: ReleaseVerdictConfig,
  argv: readonly string[] = process.argv.slice(2),
): void {
  const mode = (argOf(argv, '--mode') || '').trim();
  if (mode !== 'gate' && mode !== 'verdict') {
    console.error("::error::release-verdict: --mode must be 'gate' or 'verdict'");
    process.exit(1);
  }
  const env = process.env;
  const blockers =
    mode === 'gate' ? assertVerificationGate(config, env) : assertReleaseVerdict(config, env);
  if (mode === 'verdict' && env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, renderSummary(config, env));
  }
  const name = mode === 'gate' ? 'verification-gate' : 'release-verdict';
  for (const blocker of blockers) console.log(`::error::[${blocker.code}] ${blocker.message}`);
  if (blockers.length) {
    console.log(`${name}: ${blockers.length} blocker(s) — release stopped.`);
    process.exit(1);
  }
  console.log(`${name}: all assertions passed.`);
}
