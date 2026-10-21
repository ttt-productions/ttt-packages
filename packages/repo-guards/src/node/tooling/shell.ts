// Child processes for the tooling. On Windows `npm` and `npx` are `.cmd` shims, which Node refuses
// to spawn without a shell. Node only space-joins an args ARRAY for a shell, unescaped, and
// deprecates that form, so a command is built as one command line — and only from tokens that
// neither cmd.exe nor sh reinterprets. Any other token fails instead of reaching the shell.

import { spawn, spawnSync, type SpawnOptions } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SHELL_SAFE_TOKEN = /^[\w@+=:,./-]+$/;

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run one command through a shell and collect its output; never rejects. */
export function runCommand(
  cmd: string,
  args: readonly string[],
  opts: Omit<SpawnOptions, 'shell'> = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const unsafe = [cmd, ...args].find((token) => !SHELL_SAFE_TOKEN.test(token));
    if (unsafe !== undefined) {
      resolve({
        code: 1,
        stdout: '',
        stderr: `Refusing to run: ${JSON.stringify(unsafe)} is not a shell-safe token.`,
      });
      return;
    }
    const child = spawn([cmd, ...args].join(' '), { ...opts, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: `${stderr}\n${err.message}` }));
  });
}

/** Run `npm run <script>` with the given environment and return its exit status. */
export function runNpmScript(
  script: string,
  {
    cwd,
    env,
    stdio = 'inherit',
  }: { cwd: string; env: NodeJS.ProcessEnv; stdio?: 'inherit' | 'pipe' },
): number {
  if (!/^[\w:.-]+$/.test(script)) {
    throw new Error(
      `Refusing to run npm script ${JSON.stringify(script)}: not a plain script name.`,
    );
  }
  const result = spawnSync(`npm run ${script}`, { cwd, env, stdio, shell: true });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** Whether the module at `moduleUrl` is the script Node was started with. */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(path.resolve(entry!)).href === moduleUrl;
}
