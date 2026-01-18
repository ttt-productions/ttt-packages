import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempWorkspace {
  dir: string;
  cleanup: () => Promise<void>;
}

export async function createTempWorkspace(prefix = "ttt-media-"): Promise<TempWorkspace> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
