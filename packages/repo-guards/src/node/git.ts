import { execFileSync } from 'node:child_process';

const GIT_MAX_BUFFER = 256 * 1024 * 1024;

export function gitOutput(repoRoot: string, args: readonly string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? '').trim();
    throw new Error(
      `\`git ${args.join(' ')}\` failed in ${repoRoot}: ${stderr || (err as Error).message}`,
      { cause: err },
    );
  }
}
