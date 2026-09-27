import { describe, it, expect } from "vitest";
import {
  IMAGE_DEFAULT_OUTPUT_KEY,
  MEDIA_PIPELINE_OUTPUT_KEYS,
  TIMED_MEDIA_MAIN_OUTPUT_KEY,
  VIDEO_POSTER_OUTPUT_KEY,
} from "../src/index.js";

describe("media pipeline output keys", () => {
  it("a video is written as its main output and its poster frame", () => {
    expect(MEDIA_PIPELINE_OUTPUT_KEYS.video).toEqual([TIMED_MEDIA_MAIN_OUTPUT_KEY, VIDEO_POSTER_OUTPUT_KEY]);
  });

  it("an audio file is written as its main output only", () => {
    expect(MEDIA_PIPELINE_OUTPUT_KEYS.audio).toEqual([TIMED_MEDIA_MAIN_OUTPUT_KEY]);
  });

  it("every output key is a distinct, non-empty storage-safe name", () => {
    const keys = [TIMED_MEDIA_MAIN_OUTPUT_KEY, VIDEO_POSTER_OUTPUT_KEY, IMAGE_DEFAULT_OUTPUT_KEY];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
