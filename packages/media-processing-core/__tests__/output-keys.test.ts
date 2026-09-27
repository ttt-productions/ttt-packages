import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The keys the pipeline writes are declared once, in media-schemas (MEDIA_PIPELINE_OUTPUT_KEYS and
// its members); a consumer derives from that declaration the objects an ingest can leave behind.
// A processor that named an output with a literal would write a key nobody else knows (ENG-002).
const PROCESSORS = ["video/video-processor.ts", "audio/audio-processor.ts", "image/image-processor.ts"];

describe("processor output keys", () => {
  it.each(PROCESSORS)("%s names no output key with a string literal", (file) => {
    const source = readFileSync(join(__dirname, "..", "src", file), "utf8");
    expect(source).not.toMatch(/\bkey:\s*["'`]/);
    expect(source).not.toMatch(/outputPathFor\([^,]+,\s*["'`]/);
  });
});
