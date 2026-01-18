import type { MediaIO } from "./types";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

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
        const out = path.join(args.outputDir, `${key}${ext}`);
        await copyFile(localPath, out);
        return { path: out, url: `file://${out}` };
      },
    },
  };
}
