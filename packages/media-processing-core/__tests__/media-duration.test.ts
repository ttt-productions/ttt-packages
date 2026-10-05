import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createPacketLengthFold, measureDurationSec, unreadableLengthError } from "../src/duration/media-duration.js";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

/** A child that prints `stdoutText`, then ends with `exitCode` / `signal`. */
function fakeChild(stdoutText: string, exitCode: number | null, signal: NodeJS.Signals | null) {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  setImmediate(() => {
    child.stdout.end(stdoutText);
    child.stderr.end();
    setImmediate(() => child.emit("close", exitCode, signal));
  });
  return child;
}

function lengthOf(lines: string[]): number | undefined {
  const fold = createPacketLengthFold();
  for (const line of lines) fold.add(line);
  return fold.lengthSec();
}

const AUDIO_STREAM = "stream|index=0|codec_type=audio|disposition:attached_pic=0";
const VIDEO_STREAM = "stream|index=1|codec_type=video|disposition:attached_pic=0";

describe("createPacketLengthFold", () => {
  it("spans from the earliest packet start to the latest packet end, whatever the packet order", () => {
    expect(
      lengthOf([
        "packet|stream_index=1|pts_time=0.000000|dts_time=-0.100000|duration_time=0.100000",
        "packet|stream_index=1|pts_time=2.900000|dts_time=2.600000|duration_time=0.100000",
        "packet|stream_index=1|pts_time=2.800000|dts_time=2.700000|duration_time=0.100000",
        "packet|stream_index=0|pts_time=2.995374|dts_time=2.995374|duration_time=0.004626|",
        VIDEO_STREAM,
        AUDIO_STREAM,
      ]),
    ).toBe(3);
  });

  it("does not count pre-roll packets before zero", () => {
    expect(
      lengthOf([
        "packet|stream_index=0|pts_time=-0.023220|duration_time=0.023220",
        "packet|stream_index=0|pts_time=2.980000|duration_time=0.020000",
        AUDIO_STREAM,
      ]),
    ).toBe(3);
  });

  it("measures from the first packet when the timestamps start after zero", () => {
    expect(
      lengthOf([
        "packet|stream_index=0|pts_time=1.400000|duration_time=0.020000",
        "packet|stream_index=0|pts_time=4.380000|duration_time=0.020000",
        AUDIO_STREAM,
      ]),
    ).toBe(3);
  });

  it("is no length when every packet ends at or before zero", () => {
    expect(lengthOf(["packet|stream_index=0|pts_time=-2.000000|duration_time=1.000000", AUDIO_STREAM])).toBeUndefined();
  });

  it("falls back to the decode timestamp when a packet has no presentation timestamp", () => {
    expect(
      lengthOf([
        "packet|stream_index=0|pts_time=N/A|dts_time=0.000000|duration_time=1.000000",
        "packet|stream_index=0|pts_time=N/A|dts_time=4.000000|duration_time=1.000000",
        AUDIO_STREAM,
      ]),
    ).toBe(5);
  });

  it("ignores cover art and non-timed streams", () => {
    expect(
      lengthOf([
        "packet|stream_index=0|pts_time=0.000000|duration_time=2.000000",
        "packet|stream_index=1|pts_time=0.000000|duration_time=500.000000",
        "packet|stream_index=2|pts_time=0.000000|duration_time=900.000000",
        AUDIO_STREAM,
        "stream|index=1|codec_type=video|disposition:attached_pic=1",
        "stream|index=2|codec_type=subtitle|disposition:attached_pic=0",
      ]),
    ).toBe(2);
  });

  it("is no length when no timed stream has a timestamped packet", () => {
    expect(lengthOf([])).toBeUndefined();
    expect(lengthOf([AUDIO_STREAM])).toBeUndefined();
    expect(lengthOf(["packet|stream_index=0|pts_time=N/A|dts_time=N/A|duration_time=N/A", AUDIO_STREAM])).toBeUndefined();
    expect(lengthOf(["packet|stream_index=0|pts_time=0.000000|duration_time=3.000000"])).toBeUndefined();
  });

  it("is no length when every packet starts and ends at the same instant", () => {
    expect(lengthOf(["packet|stream_index=0|pts_time=0.000000|duration_time=0.000000", AUDIO_STREAM])).toBeUndefined();
  });

  it("reads only plain decimal times", () => {
    for (const t of ["1e3", "0x10", "inf", "NaN", ""]) {
      expect(lengthOf([`packet|stream_index=0|pts_time=${t}|duration_time=1.000000`, AUDIO_STREAM]), t).toBeUndefined();
    }
  });

  it("is no length when the file lists more streams than are tracked", () => {
    const lines = [AUDIO_STREAM];
    for (let i = 0; i <= 256; i++) lines.push(`packet|stream_index=${i}|pts_time=0.000000|duration_time=1.000000`);
    expect(lengthOf(lines)).toBeUndefined();
  });
});

describe("measureDurationSec", () => {
  const listing = [
    "packet|stream_index=0|pts_time=0.000000|duration_time=1.000000",
    "packet|stream_index=0|pts_time=1.000000|duration_time=1.000000",
    AUDIO_STREAM,
    "",
  ].join("\n");

  it("measures the listing of an ffprobe that exits cleanly", async () => {
    spawnMock.mockImplementationOnce(() => fakeChild(listing, 0, null));
    expect(await measureDurationSec("in.webm")).toBe(2);
  });

  it("is no length when ffprobe dies by a signal partway through the listing", async () => {
    spawnMock.mockImplementationOnce(() => fakeChild(listing, null, "SIGSEGV"));
    expect(await measureDurationSec("in.webm")).toBeUndefined();
  });
});

describe("unreadableLengthError", () => {
  it("is an unsupported_format refusal whose copy never claims the file is too long", () => {
    for (const kind of ["video", "audio"] as const) {
      const e = unreadableLengthError(kind, 60);
      expect(e.code).toBe("unsupported_format");
      expect(e.message.toLowerCase()).not.toContain("too long");
      expect(e.details).toEqual({ maxDurationSec: 60 });
    }
  });
});
