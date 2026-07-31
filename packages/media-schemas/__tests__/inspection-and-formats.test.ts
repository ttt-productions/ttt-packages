import { describe, it, expect } from "vitest";
import {
  ClientMediaClaimSchema,
  MediaInspectionResultSchema,
  MediaSafetyPlanSchema,
  MediaAcceptSchema,
  MEDIA_FORMATS,
  MediaFormatIdSchema,
  projectAcceptTokens,
} from "../src/index.js";

describe("ClientMediaClaimSchema", () => {
  it("accepts each action source with a kind", () => {
    for (const source of ["file-picker", "camera-capture", "media-recorder"] as const) {
      expect(ClientMediaClaimSchema.parse({ kind: "audio", source })).toEqual({ kind: "audio", source });
    }
  });

  it("accepts kind 'file' (the no-narrower-inference picker claim)", () => {
    expect(ClientMediaClaimSchema.parse({ kind: "file", source: "file-picker" }).kind).toBe("file");
  });

  it("is strict — unknown fields and sources reject", () => {
    expect(() => ClientMediaClaimSchema.parse({ kind: "audio", source: "guess" })).toThrow();
    expect(() => ClientMediaClaimSchema.parse({ kind: "audio", source: "file-picker", extra: 1 })).toThrow();
  });
});

describe("MediaInspectionResultSchema", () => {
  const base = {
    inspectorVersion: "ttt-inspect-v1",
    status: "definitive",
    canonicalKind: "audio",
    formatId: "webm",
    container: "webm",
    streams: { audio: 1, timedVideo: 0, attachedPictures: 0, imageFrames: 0, auxiliary: 0 },
    codecs: { audio: ["opus"], video: [] },
    safetyPlan: "audio-only",
    reasonCode: "ok",
  };

  it("accepts a definitive audio result", () => {
    expect(MediaInspectionResultSchema.parse(base).canonicalKind).toBe("audio");
  });

  it("rejects raw/unbounded payloads (strict + bounded fields)", () => {
    expect(() => MediaInspectionResultSchema.parse({ ...base, probeJson: "{}" })).toThrow();
    expect(() => MediaInspectionResultSchema.parse({ ...base, reasonCode: "x".repeat(200) })).toThrow();
    expect(() =>
      MediaInspectionResultSchema.parse({ ...base, codecs: { audio: ["totally-raw-codec-string"], video: [] } }),
    ).toThrow();
  });

  it("names every safety plan the classification table requires", () => {
    expect(MediaSafetyPlanSchema.options).toEqual([
      "still-image",
      "animated-image-frames",
      "video-frames",
      "audio-only",
      "audio-plus-artwork",
      "strict-video-fallback",
    ]);
  });
});

describe("format registry", () => {
  it("every enum id has a catalog entry with aliases and extensions", () => {
    for (const id of MediaFormatIdSchema.options) {
      const def = MEDIA_FORMATS[id];
      expect(def, id).toBeTruthy();
      expect(def.formatId).toBe(id);
      expect(def.extensions.length).toBeGreaterThan(0);
      const mimeCount =
        (def.mimes.all?.length ?? 0) +
        (def.mimes.image?.length ?? 0) +
        (def.mimes.video?.length ?? 0) +
        (def.mimes.audio?.length ?? 0);
      expect(mimeCount, id).toBeGreaterThan(0);
    }
  });

  it("shared A/V containers never carry an 'all' alias — their kind comes from inspection", () => {
    for (const id of ["isobmff", "webm", "ogg"] as const) {
      expect(MEDIA_FORMATS[id].family).toBe("av-container");
      expect(MEDIA_FORMATS[id].mimes.all).toBeUndefined();
    }
  });

  it("projects kind-narrowed accept tokens for an audio-only origin", () => {
    const tokens = projectAcceptTokens(["mp3", "isobmff", "webm", "ogg", "flac", "wav"], ["audio"]);
    expect(tokens).toContain("audio/mp4"); // Safari audio recording container
    expect(tokens).toContain("audio/webm");
    expect(tokens).toContain(".m4a");
    expect(tokens).not.toContain("video/mp4"); // audio origin never advertises video aliases
    expect(tokens).not.toContain("video/webm");
  });

  it("projects full aliases for a multi-kind origin and dedupes", () => {
    const tokens = projectAcceptTokens(["jpeg", "isobmff"], ["image", "video", "audio"]);
    expect(tokens).toContain("image/jpeg");
    expect(tokens).toContain("video/mp4");
    expect(tokens).toContain("audio/mp4");
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("MediaAcceptSchema.formats is optional (legacy accept parses) and enum-bounded", () => {
    expect(MediaAcceptSchema.parse({ kinds: ["image"] }).formats).toBeUndefined();
    expect(MediaAcceptSchema.parse({ kinds: ["image"], formats: ["jpeg", "png"] }).formats).toEqual([
      "jpeg",
      "png",
    ]);
    expect(() => MediaAcceptSchema.parse({ formats: ["exe"] })).toThrow();
  });
});
