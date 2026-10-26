import { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { vi } from 'vitest';

function pipedChild<K extends ChildProcess['kill']>(kill: K) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdio: [null, PassThrough, PassThrough, undefined, undefined] = [
    null,
    stdout,
    stderr,
    undefined,
    undefined,
  ];
  return Object.assign(new ChildProcess(), { stdin: null, stdout, stderr, stdio, kill });
}

export function exitingChild(
  stdoutText: string,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
) {
  const child = pipedChild(() => true);
  setImmediate(() => {
    child.stdout.end(stdoutText);
    child.stderr.end();
    setImmediate(() => child.emit('close', exitCode, signal));
  });
  return child;
}

export function hangingChild() {
  const child = pipedChild(
    vi.fn<ChildProcess['kill']>(() => {
      setImmediate(() => child.emit('close', null, 'SIGKILL'));
      return true;
    }),
  );
  return child;
}
