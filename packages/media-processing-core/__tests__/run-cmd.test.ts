import { describe, it, expect } from "vitest";
import { runCmd } from "../src/video/ffmpeg.js";

function node(script: string) {
  return [process.execPath, ["-e", script]] as const;
}

describe("runCmd onStdoutLine", () => {
  it("delivers whole lines across chunk boundaries, CRLF included, and the unterminated last line", async () => {
    const lines: string[] = [];
    const [cmd, args] = node(
      "const w=(s)=>new Promise(r=>process.stdout.write(s,r));" +
        "(async()=>{await w('alpha|1\\r\\nbe');await new Promise(r=>setTimeout(r,20));await w('ta|2\\ngam');await new Promise(r=>setTimeout(r,20));await w('ma|3');})();",
    );
    const r = await runCmd(cmd, [...args], { onStdoutLine: (line) => lines.push(line) });
    expect(r.code).toBe(0);
    expect(r.truncated).toBeUndefined();
    expect(r.stdout).toBe("");
    expect(lines).toEqual(["alpha|1", "beta|2", "gamma|3"]);
  });

  it("keeps a multi-byte character intact when it is split across two chunks", async () => {
    const lines: string[] = [];
    const [cmd, args] = node(
      "const w=(b)=>new Promise(r=>process.stdout.write(Buffer.from(b),r));" +
        "(async()=>{await w([0x63,0xc3]);await new Promise(r=>setTimeout(r,20));await w([0xa9,0x0a]);})();",
    );
    const r = await runCmd(cmd, [...args], { onStdoutLine: (line) => lines.push(line) });
    expect(r.code).toBe(0);
    expect(lines).toEqual(["cé"]);
  });

  it("marks the result truncated and stops delivering when one line exceeds the capture cap", async () => {
    const lines: string[] = [];
    const [cmd, args] = node("process.stdout.write('ok\\n' + 'x'.repeat(2 * 1024 * 1024) + '\\nafter\\n');");
    const r = await runCmd(cmd, [...args], { onStdoutLine: (line) => lines.push(line) });
    expect(r.truncated).toBe(true);
    expect(lines.every((line) => line.length <= 1024 * 1024)).toBe(true);
    expect(lines).not.toContain("after");
  });
});
