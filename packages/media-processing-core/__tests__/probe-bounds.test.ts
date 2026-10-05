import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { probeVideo } from "../src/video/probe.js";
import { probeAudio } from "../src/audio/probe.js";
import { processVideo } from "../src/video/video-processor.js";
import { processAudio } from "../src/audio/audio-processor.js";
import { DEFAULT_PROBE_TIMEOUT_MS } from "../src/video/ffmpeg.js";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

/** An ffprobe that never finishes on its own: only a kill ends it. */
function hangingChild() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      setImmediate(() => child.emit("close", null, "SIGKILL"));
      return true;
    }),
  });
  return child;
}

/** `ffmpeg -version` answering at once, so the processors reach their probe. */
function versionChild() {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  setImmediate(() => {
    child.stdout.end("ffmpeg version test\n");
    child.stderr.end();
    setImmediate(() => child.emit("close", 0, null));
  });
  return child;
}

function routeSpawn(probe: ReturnType<typeof hangingChild>) {
  spawnMock.mockImplementation((cmd: string, args: string[]) => (cmd === "ffmpeg" && args[0] === "-version" ? versionChild() : probe));
}

afterEach(() => {
  vi.useRealTimers();
  spawnMock.mockReset();
});

describe("the processors' ffprobe calls are bounded and fail closed", () => {
  for (const [name, probe] of [
    ["probeVideo", probeVideo],
    ["probeAudio", probeAudio],
  ] as const) {
    it(`${name} kills an ffprobe that outlives the probe timeout and throws`, async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const child = hangingChild();
      routeSpawn(child);
      const result = probe("in.media").then(
        () => "resolved",
        () => "threw",
      );
      await vi.advanceTimersByTimeAsync(DEFAULT_PROBE_TIMEOUT_MS - 1);
      expect(child.kill).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(child.kill).toHaveBeenCalled();
      expect(await result).toBe("threw");
    });

    it(`${name} kills ffprobe on abort and throws`, async () => {
      const child = hangingChild();
      routeSpawn(child);
      const controller = new AbortController();
      const result = probe("in.media", { signal: controller.signal }).then(
        () => "resolved",
        () => "threw",
      );
      controller.abort();
      expect(await result).toBe("threw");
      expect(child.kill).toHaveBeenCalled();
    });
  }

  it("a processor aborted during its probe reports processing_canceled and produces nothing", async () => {
    const out = (name: string) => path.join(tmpdir(), "mpc-probe-bounds", name);
    for (const run of [
      (signal: AbortSignal) => processVideo({ kind: "video", maxDurationSec: 60 }, { inputPath: "in.webm", outputBasePath: out("v") }, { signal }),
      (signal: AbortSignal) => processAudio({ kind: "audio", maxDurationSec: 60 }, { inputPath: "in.webm", outputBasePath: out("a") }, { signal }),
    ]) {
      const child = hangingChild();
      routeSpawn(child);
      const controller = new AbortController();
      const pending = run(controller.signal);
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledWith("ffprobe", expect.anything(), expect.anything()));
      controller.abort();
      const r = await pending;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("processing_canceled");
      expect(child.kill).toHaveBeenCalled();
    }
  });
});
