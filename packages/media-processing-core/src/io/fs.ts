import type { MediaIO } from "./types.js";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sanitizeKey } from "../utils/safe-path.js";

export function createFsIO(args: {
  inputPath: string;
  inputMime?: string;
  outputDir: string;
}): MediaIO {
  return {
    input: {
      mime: args.inputMime,
      async readToFile(localPath) {
        await copyFile(args.inputPath, localPath);
      },
    },
    output: {
      async writeFromFile(localPath, key) {
        await mkdir(args.outputDir, { recursive: true });
        const ext = path.extname(localPath);
        const safeKey = sanitizeKey(key);
        const out = path.join(args.outputDir, `${safeKey}${ext}`);

        // Ensure final path stays within outputDir.
        const resolvedDir = path.resolve(args.outputDir);
        const resolvedOut = path.resolve(out);
        if (!resolvedOut.startsWith(resolvedDir + path.sep) && resolvedOut !== resolvedDir) {
          throw new Error("Unsafe output path");
        }
        await copyFile(localPath, out);
        return { path: out, url: `file://${out}` };
      },
    },
  };
}
