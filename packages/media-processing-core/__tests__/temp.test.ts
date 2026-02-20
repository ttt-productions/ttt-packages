import { describe, it, expect, afterEach } from 'vitest';
import { createTempWorkspace } from '../src/workspace/temp';
import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const workspaces: Array<{ cleanup: () => Promise<void> }> = [];

afterEach(async () => {
  for (const ws of workspaces) {
    await ws.cleanup().catch(() => {});
  }
  workspaces.length = 0;
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('createTempWorkspace', () => {
  it('creates a temp directory that exists on disk', async () => {
    const ws = await createTempWorkspace();
    workspaces.push(ws);
    expect(await exists(ws.dir)).toBe(true);
  });

  it('directory starts with the default prefix "ttt-media-"', async () => {
    const ws = await createTempWorkspace();
    workspaces.push(ws);
    const base = path.basename(ws.dir);
    expect(base.startsWith('ttt-media-')).toBe(true);
  });

  it('creates directory inside os.tmpdir()', async () => {
    const ws = await createTempWorkspace();
    workspaces.push(ws);
    const tmpDir = os.tmpdir();
    expect(ws.dir.startsWith(tmpDir)).toBe(true);
  });

  it('cleanup() removes the directory', async () => {
    const ws = await createTempWorkspace();
    expect(await exists(ws.dir)).toBe(true);
    await ws.cleanup();
    expect(await exists(ws.dir)).toBe(false);
  });

  it('works with a custom prefix', async () => {
    const ws = await createTempWorkspace('my-custom-prefix-');
    workspaces.push(ws);
    const base = path.basename(ws.dir);
    expect(base.startsWith('my-custom-prefix-')).toBe(true);
  });

  it('each call creates a unique directory', async () => {
    const ws1 = await createTempWorkspace();
    const ws2 = await createTempWorkspace();
    workspaces.push(ws1, ws2);
    expect(ws1.dir).not.toBe(ws2.dir);
  });

  it('cleanup() is idempotent (no error on second call)', async () => {
    const ws = await createTempWorkspace();
    await ws.cleanup();
    await expect(ws.cleanup()).resolves.toBeUndefined();
  });
});
