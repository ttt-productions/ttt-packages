import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectMedia, detectSignatureFamily, type InspectMediaDeps } from "../src/inspection/inspect-media.js";

// Unit layer: the classification TABLE with injected probe/decoder deps —
// no external tools. The real-tool integration matrix lives in
// inspect-media.fixtures.test.ts.

async function tempFileWith(bytes: Uint8Array | Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mpc-inspect-"));
  const p = path.join(dir, "input");
  await writeFile(p, bytes);
  return p;
}

// signature prefixes
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(16, 1)]);
function ftyp(brand: string): Buffer {
  return Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftyp"), Buffer.from(brand.padEnd(4)), Buffer.alloc(8, 0)]);
}
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 0)]);

function probeReturning(json: unknown): NonNullable<InspectMediaDeps["probe"]> {
  return async () => ({ ok: true, json });
}
const decodeFails: NonNullable<InspectMediaDeps["decodeImage"]> = async () => null;
const decodeStill: NonNullable<InspectMediaDeps["decodeImage"]> = async () => ({ frames: 1 });
const decodeAnimated: NonNullable<InspectMediaDeps["decodeImage"]> = async () => ({ frames: 2 });

const V = { ffprobeVersion: "ffprobe version test" };

describe("detectSignatureFamily", () => {
  it("routes the classic signatures", () => {
    expect(detectSignatureFamily(JPEG)).toEqual({ family: "image", formatId: "jpeg", container: "jpeg" });
    expect(detectSignatureFamily(EBML)).toEqual({ family: "ebml" });
    expect(detectSignatureFamily(OGG)).toEqual({ family: "ogg" });
    expect(detectSignatureFamily(ftyp("mp42"))).toEqual({ family: "isobmff", brand: "mp42" });
    expect(detectSignatureFamily(ftyp("avif"))).toEqual({ family: "isobmff", brand: "avif" });
    expect(detectSignatureFamily(Buffer.from("<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>")).family).toBe("svg");
    expect(detectSignatureFamily(Buffer.alloc(64, 0x55))).toEqual({ family: "unknown" });
  });
});

describe("inspectMedia classification table (injected deps)", () => {
  it("audio-only WebM streams → definitive audio, audio-only plan", async () => {
    const p = await tempFileWith(EBML);
    const r = await inspectMedia({
      localPath: p,
      deps: { ...V, probe: probeReturning({ streams: [{ codec_type: "audio", codec_name: "opus" }] }), decodeImage: decodeFails },
    });
    expect(r.status).toBe("definitive");
    expect(r.canonicalKind).toBe("audio");
    expect(r.safetyPlan).toBe("audio-only");
    expect(r.formatId).toBe("webm");
    expect(r.codecs.audio).toEqual(["opus"]);
  });

  it("ANY timed video stream wins, even with audio present (Ogg/Theora — the bypass regression)", async () => {
    const p = await tempFileWith(OGG);
    const r = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({
          streams: [
            { codec_type: "audio", codec_name: "vorbis" },
            { codec_type: "video", codec_name: "theora" },
          ],
        }),
      },
    });
    expect(r.canonicalKind).toBe("video");
    expect(r.safetyPlan).toBe("video-frames");
    expect(r.codecs.video).toEqual(["theora"]);
  });

  it("mp42-brand ISO-BMFF with one AAC stream → audio (brand NEVER decides — the Safari regression)", async () => {
    const p = await tempFileWith(ftyp("mp42"));
    const r = await inspectMedia({
      localPath: p,
      deps: { ...V, probe: probeReturning({ streams: [{ codec_type: "audio", codec_name: "aac" }] }) },
    });
    expect(r.canonicalKind).toBe("audio");
    expect(r.container).toBe("isobmff");
    expect(r.codecs.audio).toEqual(["aac"]);
  });

  it("audio + attached picture → audio with the audio-plus-artwork plan (never plain audio-only)", async () => {
    const p = await tempFileWith(ftyp("isom"));
    const r = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({
          streams: [
            { codec_type: "audio", codec_name: "aac" },
            { codec_type: "video", codec_name: "mjpeg", disposition: { attached_pic: 1 } },
          ],
        }),
      },
    });
    expect(r.canonicalKind).toBe("audio");
    expect(r.safetyPlan).toBe("audio-plus-artwork");
    expect(r.streams.attachedPictures).toBe(1);
    expect(r.streams.timedVideo).toBe(0);
  });

  it("audio + subtitle/data streams stays audio; audio + UNKNOWN stream type is indeterminate", async () => {
    const p = await tempFileWith(EBML);
    const withSubs = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({
          streams: [
            { codec_type: "audio", codec_name: "opus" },
            { codec_type: "subtitle", codec_name: "webvtt" },
          ],
        }),
      },
    });
    expect(withSubs.canonicalKind).toBe("audio");
    expect(withSubs.streams.auxiliary).toBe(1);

    const withMystery = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({
          streams: [
            { codec_type: "audio", codec_name: "opus" },
            { codec_type: "something_new" },
          ],
        }),
      },
    });
    expect(withMystery.status).toBe("indeterminate");
    expect(withMystery.safetyPlan).toBe("strict-video-fallback");
  });

  it("probe timeout / truncation / failure / bad JSON / empty streams are ALL indeterminate + strict-video-fallback — never audio", async () => {
    const p = await tempFileWith(EBML);
    for (const reason of ["timeout", "truncated", "failed", "bad_json"] as const) {
      const r = await inspectMedia({ localPath: p, deps: { ...V, probe: async () => ({ ok: false, reason }) } });
      expect(r.status, reason).toBe("indeterminate");
      expect(r.safetyPlan, reason).toBe("strict-video-fallback");
      expect(r.reasonCode).toBe(`probe_${reason}`);
    }
    const empty = await inspectMedia({ localPath: p, deps: { ...V, probe: probeReturning({ streams: [] }) } });
    expect(empty.status).toBe("indeterminate");
    expect(empty.reasonCode).toBe("no_streams");
  });

  it("still image signature: decode proof required — decode failure is malformed, never image", async () => {
    const p = await tempFileWith(JPEG);
    const ok = await inspectMedia({ localPath: p, deps: { ...V, decodeImage: decodeStill } });
    expect(ok.canonicalKind).toBe("image");
    expect(ok.safetyPlan).toBe("still-image");

    const bad = await inspectMedia({ localPath: p, deps: { ...V, decodeImage: decodeFails } });
    expect(bad.status).toBe("malformed");
    expect(bad.reasonCode).toBe("image_decode_failed");
    expect(bad.safetyPlan).toBe("strict-video-fallback");
  });

  it("a MULTI-FRAME image gets the animated-image-frames plan (frame-zero-only hashing is never clean)", async () => {
    const p = await tempFileWith(JPEG);
    const r = await inspectMedia({ localPath: p, deps: { ...V, decodeImage: decodeAnimated } });
    expect(r.canonicalKind).toBe("image");
    expect(r.safetyPlan).toBe("animated-image-frames");
    expect(r.streams.imageFrames).toBe(2);
  });

  it("AVIF: image brand + decode proof + no audio → image, despite probing as an AV1 video stream", async () => {
    const p = await tempFileWith(ftyp("avif"));
    const r = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({ streams: [{ codec_type: "video", codec_name: "av1" }] }),
        decodeImage: decodeStill,
      },
    });
    expect(r.canonicalKind).toBe("image");
    expect(r.formatId).toBe("avif");
    expect(r.safetyPlan).toBe("still-image");
  });

  it("image-brand file WITH audio is NOT an image — fails toward the stricter visual path", async () => {
    const p = await tempFileWith(ftyp("avif"));
    const r = await inspectMedia({
      localPath: p,
      deps: {
        ...V,
        probe: probeReturning({
          streams: [
            { codec_type: "video", codec_name: "av1" },
            { codec_type: "audio", codec_name: "aac" },
          ],
        }),
        decodeImage: decodeStill,
      },
    });
    expect(r.status).toBe("indeterminate");
    expect(r.safetyPlan).toBe("strict-video-fallback");
    expect(r.reasonCode).toBe("image_brand_with_audio");
  });

  it("HEIC the runtime cannot decode → explicit unsupported, NEVER video (launch policy)", async () => {
    const p = await tempFileWith(ftyp("heic"));
    const r = await inspectMedia({
      localPath: p,
      deps: { ...V, probe: probeReturning({ streams: [{ codec_type: "video", codec_name: "hevc" }] }), decodeImage: decodeFails },
    });
    expect(r.status).toBe("unsupported");
    expect(r.formatId).toBe("heic");
    expect(r.reasonCode).toBe("unsupported_format:heic");
    expect(r.canonicalKind).toBeUndefined();
  });

  it("SVG is structurally recognized and explicitly unsupported (scriptable format)", async () => {
    const p = await tempFileWith(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    const r = await inspectMedia({ localPath: p, deps: V });
    expect(r.status).toBe("unsupported");
    expect(r.formatId).toBe("svg");
    expect(r.reasonCode).toBe("unsupported_format:svg");
  });

  it("unknown signature is indeterminate (strict-video fallback), never a guess", async () => {
    const p = await tempFileWith(Buffer.alloc(64, 0x55));
    const r = await inspectMedia({ localPath: p, deps: V });
    expect(r.status).toBe("indeterminate");
    expect(r.reasonCode).toBe("unrecognized_signature");
  });

  it("normalizes unknown codec names to the bounded 'other' — raw probe strings never escape", async () => {
    const p = await tempFileWith(EBML);
    const r = await inspectMedia({
      localPath: p,
      deps: { ...V, probe: probeReturning({ streams: [{ codec_type: "audio", codec_name: "some_vendor_codec_v99" }] }) },
    });
    expect(r.codecs.audio).toEqual(["other"]);
  });
});
