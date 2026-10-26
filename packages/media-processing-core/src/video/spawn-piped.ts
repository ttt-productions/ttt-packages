import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

export type PipedChildProcess = ChildProcessByStdio<null, Readable, Readable>;

export function spawnPiped(cmd: string, args: readonly string[], cwd?: string): PipedChildProcess {
  return spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}
