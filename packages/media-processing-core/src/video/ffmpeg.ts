import { spawn } from "node:child_process";

export interface RunCmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runCmd(cmd: string, args: string[], opts?: { cwd?: string }): Promise<RunCmdResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts?.cwd, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    p.stdout.on("data", (d) => (stdout += String(d)));
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}
