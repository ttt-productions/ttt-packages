import { describe, it, expect } from "vitest";
import { MediaAcceptSchema } from "@ttt-productions/media-schemas";
import { TTT_MEDIA_SPECS } from "../src/media/ttt-media-specs.js";

// LAUNCH FORMAT POLICY PIN (canonical-upload-content-classification, DJ
// 2026-07-31): what every origin's picker advertises and the server accepts.
// A change here is a deliberate policy edit plus that format's
// processing/safety proof — never a drive-by.

describe("TTT media format policy (launch)", () => {
  const origins = Object.entries(TTT_MEDIA_SPECS);

  it("every origin with an accept block declares an explicit formats selection that parses", () => {
    for (const [origin, spec] of origins) {
      const accept = (spec as { accept?: unknown }).accept;
      if (!accept) continue;
      const parsed = MediaAcceptSchema.parse(accept);
      expect(parsed.formats && parsed.formats.length, origin).toBeTruthy();
    }
  });

  it("svg, heic, and avif are DISABLED everywhere (scriptable / unproven decode+scan paths)", () => {
    for (const [origin, spec] of origins) {
      const formats: string[] = (spec as { accept?: { formats?: string[] } }).accept?.formats ?? [];
      for (const banned of ["svg", "heic", "avif"]) {
        expect(formats, `${origin} must not enable ${banned}`).not.toContain(banned);
      }
    }
  });

  it("audio-accepting origins include isobmff (Safari records audio/mp4) and webm (Chrome/Firefox recorders)", () => {
    for (const [origin, spec] of origins) {
      const accept = (spec as { accept?: { kinds?: string[]; formats?: string[] } }).accept;
      if (!accept?.kinds?.includes("audio")) continue;
      expect(accept.formats, origin).toContain("isobmff");
      expect(accept.formats, origin).toContain("webm");
    }
  });

  it("image-accepting origins carry the proven raster set", () => {
    for (const [origin, spec] of origins) {
      const accept = (spec as { accept?: { kinds?: string[]; formats?: string[] } }).accept;
      if (!accept?.kinds?.includes("image")) continue;
      for (const f of ["jpeg", "png", "gif", "webp"]) {
        expect(accept.formats, origin).toContain(f);
      }
    }
  });
});
