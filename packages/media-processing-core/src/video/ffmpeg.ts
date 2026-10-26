import type { ChildProcess } from 'node:child_process';
import { spawnPiped } from './spawn-piped.js';

export interface RunCmdResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  truncated?: boolean;
}

export type FfmpegProgressPhase = 'transcode' | 'poster';

export interface RunFfmpegOptions {
  cwd?: string;
  signal?: AbortSignal;
  durationMs?: number;
  onProgress?: (p: { phase: FfmpegProgressPhase; percent?: number; outTimeMs?: number }) => void;
  phase?: FfmpegProgressPhase;
}

const MAX_CAPTURE_BYTES = 1024 * 1024;

export const DEFAULT_PROBE_TIMEOUT_MS = 20_000;

let ffmpegChecked: boolean | null = null;
let ffmpegVersion: string | null = null;

function forceKill(p: ChildProcess): void {
  try {
    p.kill('SIGKILL');
  } catch {
    // A process that already exited throws on kill, and there is nothing left to stop.
  }
}

export function runCmd(
  cmd: string,
  args: string[],
  opts?: {
    cwd?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    onStdoutLine?: (line: string) => void;
  },
): Promise<RunCmdResult> {
  return new Promise((resolve, reject) => {
    const p = spawnPiped(cmd, args, opts?.cwd);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let truncated = false;

    const kill = () => forceKill(p);
    const timer =
      opts?.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            kill();
          }, opts.timeoutMs)
        : null;
    const onAbort = () => {
      timedOut = true;
      kill();
    };
    if (opts?.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    const onLine = opts?.onStdoutLine;
    let lineBuf = '';
    // Decodes across chunk boundaries, so a multi-byte character split between chunks stays intact.
    if (onLine) p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      if (onLine) {
        if (truncated) return;
        const lines = (lineBuf + String(d)).split(/\r?\n/);
        lineBuf = lines.pop() ?? '';
        for (const line of [...lines, lineBuf]) {
          if (line.length > MAX_CAPTURE_BYTES) {
            truncated = true;
            lineBuf = '';
            return;
          }
        }
        for (const line of lines) onLine(line);
        return;
      }
      if (stdout.length < MAX_CAPTURE_BYTES) stdout += String(d);
      else truncated = true;
    });
    p.stderr.on('data', (d) => {
      if (stderr.length < MAX_CAPTURE_BYTES) stderr += String(d);
      else truncated = true;
    });

    p.on('error', (e) => {
      if (timer) clearTimeout(timer);
      if (opts?.signal) opts.signal.removeEventListener('abort', onAbort);
      reject(e);
    });
    p.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (opts?.signal) opts.signal.removeEventListener('abort', onAbort);
      if (onLine && !truncated && lineBuf) onLine(lineBuf);
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
        ...(timedOut ? { timedOut } : {}),
        ...(truncated ? { truncated } : {}),
      });
    });
  });
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

// ffmpeg's `out_time_ms` is in microseconds.
function parseOutTimeMicroseconds(value: string): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;

  const MAX_REASONABLE_US = 100 * 365 * 24 * 60 * 60 * 1_000_000;
  if (n > MAX_REASONABLE_US) return undefined;

  return n;
}

function parseOutTimeHmsToMs(value: string): number | undefined {
  const m = String(value)
    .trim()
    .match(/^(\d+):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?$/);
  if (!m) return undefined;

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return undefined;

  const frac = m[4] ?? '';
  const us = frac ? Number((frac + '000000').slice(0, 6)) : 0;
  if (!Number.isFinite(us) || us < 0) return undefined;

  const totalMs = (hh * 3600 + mm * 60 + ss) * 1000 + Math.floor(us / 1000);
  return totalMs >= 0 ? totalMs : undefined;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return undefined;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function runFfmpeg(args: string[], opts?: RunFfmpegOptions): Promise<RunCmdResult> {
  const phase: FfmpegProgressPhase = opts?.phase ?? 'transcode';
  const withProgress = !!opts?.onProgress;
  const ffArgs = withProgress ? ['-progress', 'pipe:1', '-nostats', ...args] : args;

  return new Promise((resolve, reject) => {
    if (opts?.signal?.aborted) return reject(abortError());

    const p = spawnPiped('ffmpeg', ffArgs, opts?.cwd);

    let stdout = '';
    let stderr = '';
    let progressBuf = '';

    let lastOutTimeMs: number | undefined;

    const onAbort = () => forceKill(p);
    opts?.signal?.addEventListener('abort', onAbort, { once: true });

    p.stdout.on('data', (d) => {
      const s = String(d);
      if (stdout.length < MAX_CAPTURE_BYTES) stdout += s;

      if (!withProgress) return;

      progressBuf += s;
      const lines = progressBuf.split(/\r?\n/);
      progressBuf = lines.pop() ?? '';

      let outTimeMs: number | undefined;

      for (const line of lines) {
        const idx = line.indexOf('=');
        if (idx <= 0) continue;

        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();

        if (k === 'out_time_ms') {
          const us = parseOutTimeMicroseconds(v);
          if (us !== undefined) outTimeMs = Math.floor(us / 1000);
        } else if (k === 'out_time' && outTimeMs == null) {
          const ms = parseOutTimeHmsToMs(v);
          if (ms !== undefined) outTimeMs = ms;
        } else if (k === 'progress' && v === 'end') {
          opts?.onProgress?.({ phase, percent: 1, outTimeMs: lastOutTimeMs });
        }
      }

      if (outTimeMs != null) {
        if (lastOutTimeMs == null || outTimeMs >= lastOutTimeMs) {
          lastOutTimeMs = outTimeMs;
        }

        const dur = opts?.durationMs;
        const percent =
          dur && dur > 0 && lastOutTimeMs != null
            ? clamp01(Math.min(0.999, lastOutTimeMs / dur))
            : undefined;

        opts?.onProgress?.({ phase, percent, outTimeMs: lastOutTimeMs });
      }
    });

    p.stderr.on('data', (d) => {
      const s = String(d);
      if (stderr.length < MAX_CAPTURE_BYTES) stderr += s;
    });

    p.on('error', (e) => {
      opts?.signal?.removeEventListener('abort', onAbort);
      reject(e);
    });

    p.on('close', (code) => {
      opts?.signal?.removeEventListener('abort', onAbort);
      if (opts?.signal?.aborted) return reject(abortError());
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

export async function ensureFfmpegAvailable(): Promise<
  { ok: true; version?: string } | { ok: false; error: unknown }
> {
  if (ffmpegChecked) return { ok: true, version: ffmpegVersion ?? undefined };

  try {
    const r = await runCmd('ffmpeg', ['-version']);
    if (r.code === 0) {
      ffmpegChecked = true;
      ffmpegVersion = (r.stdout || r.stderr || '').split(/\r?\n/)[0] || null;
      return { ok: true, version: ffmpegVersion ?? undefined };
    }
    return { ok: false, error: new Error('ffmpeg not available') };
  } catch (e) {
    return { ok: false, error: e };
  }
}
