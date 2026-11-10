import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tempRepo } from './temp-repo.js';

describe('a test fixture removes itself', () => {
  let failedRoot = '';
  let failedExisted = false;
  let keptRoot = '';
  let keptExisted = false;

  it.fails('builds a fixture and fails before removing it', () => {
    failedRoot = tempRepo({ 'src/index.ts': 'export {};' }).root;
    failedExisted = existsSync(failedRoot);
    throw new Error('the case failed before any cleanup it would have run');
  });

  it('removed the fixture of the case that failed', () => {
    expect(failedExisted).toBe(true);
    expect(existsSync(failedRoot)).toBe(false);
  });

  it('builds a fixture and never removes it', () => {
    keptRoot = tempRepo({ 'src/index.ts': 'export {};' }).root;
    keptExisted = existsSync(keptRoot);
  });

  it('removed the fixture its case never removed', () => {
    expect(keptExisted).toBe(true);
    expect(existsSync(keptRoot)).toBe(false);
  });

  it('removes on request, and a second removal is no failure', () => {
    const repo = tempRepo({ 'src/index.ts': 'export {};' });
    expect(existsSync(repo.root)).toBe(true);
    repo.remove();
    expect(existsSync(repo.root)).toBe(false);
    expect(() => repo.remove()).not.toThrow();
  });
});
