import { spawn } from "node:child_process";

export interface RunCmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

const MAX_CAPTURE_BYTES = 1024 * 1024; // 1MB per stream

let ffmpegChecked: boolean | null = null;
let ffmpegVersion: string | null = null;

export function runCmd(cmd: string, args: string[], opts?: { cwd?: string }): Promise<RunCmdResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts?.cwd, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    p.stdout.on("data", (d) => {
      if (stdout.length < MAX_CAPTURE_BYTES) stdout += String(d);
    });
    p.stderr.on("data", (d) => {
      if (stderr.length < MAX_CAPTURE_BYTES) stderr += String(d);
    });

    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function ensureFfmpegAvailable(): Promise<{ ok: true; version?: string } | { ok: false; error: unknown }> {
  if (ffmpegChecked) return { ok: true, version: ffmpegVersion ?? undefined };

  try {
    const r = await runCmd("ffmpeg", ["-version"]);
    if (r.code === 0) {
      ffmpegChecked = true;
      ffmpegVersion = (r.stdout || r.stderr || "").split(/\r?\n/)[0] || null;
      return { ok: true, version: ffmpegVersion ?? undefined };
    }
    return { ok: false, error: new Error("ffmpeg not available") };
  } catch (e) {
    return { ok: false, error: e };
  }
}
