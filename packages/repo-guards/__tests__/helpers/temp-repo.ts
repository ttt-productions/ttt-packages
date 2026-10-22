import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TempRepo {
  root: string;
  write(relPath: string, text?: string): void;
  remove(): void;
}

export function tempRepo(files: Record<string, string> = {}): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'repo-guards-'));
  const write = (relPath: string, text = 'export {};') => {
    mkdirSync(join(root, relPath, '..'), { recursive: true });
    writeFileSync(join(root, relPath), text);
  };
  for (const [relPath, text] of Object.entries(files)) write(relPath, text);
  return { root, write, remove: () => rmSync(root, { recursive: true, force: true }) };
}
