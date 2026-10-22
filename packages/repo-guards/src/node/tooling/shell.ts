// On Windows `npm` and `npx` are `.cmd` shims Node spawns only through a shell, and Node joins an
// args array for a shell unescaped, so a command is one command line.

import { spawn, spawnSync, type SpawnOptions } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SHELL_SAFE_TOKEN = /^[\w@+=:,./-]+$/;

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

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

export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(path.resolve(entry!)).href === moduleUrl;
}
