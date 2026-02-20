import { describe, it, expect, afterEach } from 'vitest';
import { createFsIO } from '../src/io/fs';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-io-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const d of tmpDirs) {
    await rm(d, { recursive: true, force: true }).catch(() => {});
  }
  tmpDirs.length = 0;
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('createFsIO', () => {
  describe('input.readToFile()', () => {
    it('copies the input file to the destination path', async () => {
      const srcDir = await makeTmpDir();
      const destDir = await makeTmpDir();

      const inputPath = path.join(srcDir, 'input.txt');
      await writeFile(inputPath, 'hello world');

      const destPath = path.join(destDir, 'dest.txt');

      const io = createFsIO({ inputPath, outputDir: destDir });
      await io.input.readToFile(destPath);

      const content = await readFile(destPath, 'utf8');
      expect(content).toBe('hello world');
    });

    it('preserves file content exactly', async () => {
      const srcDir = await makeTmpDir();
      const destDir = await makeTmpDir();

      const inputPath = path.join(srcDir, 'data.bin');
      const buffer = Buffer.from([0x00, 0xff, 0x42, 0xaa]);
      await writeFile(inputPath, buffer);

      const destPath = path.join(destDir, 'out.bin');
      const io = createFsIO({ inputPath, outputDir: destDir });
      await io.input.readToFile(destPath);

      const result = await readFile(destPath);
      expect(result).toEqual(buffer);
    });
  });

  describe('output.writeFromFile()', () => {
    it('copies file to outputDir with sanitized key', async () => {
      const srcDir = await makeTmpDir();
      const outputDir = await makeTmpDir();

      const localPath = path.join(srcDir, 'processed.jpg');
      await writeFile(localPath, 'image data');

      const io = createFsIO({ inputPath: localPath, outputDir });
      const result = await io.output.writeFromFile(localPath, 'thumbnail');

      expect(await exists(result.path)).toBe(true);
      const content = await readFile(result.path, 'utf8');
      expect(content).toBe('image data');
    });

    it('returns path and url', async () => {
      const srcDir = await makeTmpDir();
      const outputDir = await makeTmpDir();
      const localPath = path.join(srcDir, 'out.mp4');
      await writeFile(localPath, 'video');

      const io = createFsIO({ inputPath: localPath, outputDir });
      const result = await io.output.writeFromFile(localPath, 'main');

      expect(typeof result.path).toBe('string');
      expect(result.url).toMatch(/^file:\/\//);
    });

    it('creates outputDir if it does not exist', async () => {
      const srcDir = await makeTmpDir();
      const parentDir = await makeTmpDir();
      const outputDir = path.join(parentDir, 'nested', 'output');

      const localPath = path.join(srcDir, 'file.txt');
      await writeFile(localPath, 'data');

      const io = createFsIO({ inputPath: localPath, outputDir });
      await io.output.writeFromFile(localPath, 'result');

      expect(await exists(outputDir)).toBe(true);
    });

    it('sanitizes path traversal key to stay within outputDir', async () => {
      const srcDir = await makeTmpDir();
      const outputDir = await makeTmpDir();
      const localPath = path.join(srcDir, 'file.txt');
      await writeFile(localPath, 'data');

      const io = createFsIO({ inputPath: localPath, outputDir });

      // sanitizeKey replaces traversal chars — output should stay within outputDir
      const result = await io.output.writeFromFile(localPath, '../../../etc/passwd');
      expect(result.path.startsWith(outputDir)).toBe(true);
    });

    it('preserves file extension from the localPath', async () => {
      const srcDir = await makeTmpDir();
      const outputDir = await makeTmpDir();
      const localPath = path.join(srcDir, 'image.webp');
      await writeFile(localPath, 'webp data');

      const io = createFsIO({ inputPath: localPath, outputDir });
      const result = await io.output.writeFromFile(localPath, 'converted');

      expect(result.path.endsWith('.webp')).toBe(true);
    });
  });

  describe('input.mime', () => {
    it('is set when inputMime provided', () => {
      const io = createFsIO({ inputPath: '/tmp/test.jpg', inputMime: 'image/jpeg', outputDir: '/tmp' });
      expect(io.input.mime).toBe('image/jpeg');
    });

    it('is undefined when inputMime not provided', () => {
      const io = createFsIO({ inputPath: '/tmp/test.jpg', outputDir: '/tmp' });
      expect(io.input.mime).toBeUndefined();
    });
  });
});
