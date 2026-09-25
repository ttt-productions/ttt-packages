import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// scripts/package-order.mjs prints the one dependency-safe package order — the root package.json
// build chain — and every build and release walks it. A package built before an internal package it
// declares compiles against a missing dist; one released first publishes a caret range to a version
// npm does not have yet.

const INTERNAL = '@ttt-productions/';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

type Manifest = { name: string } & Partial<Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>>;

const packagesDir = join(REPO_ROOT, 'packages');
const folders = readdirSync(packagesDir).filter((dir) => existsSync(join(packagesDir, dir, 'package.json')));
const manifest = (dir: string) => JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')) as Manifest;
const order = execFileSync(process.execPath, [join(REPO_ROOT, 'scripts', 'package-order.mjs')], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((line) => line.length > 0);

describe('boundary: one dependency-safe package order', () => {
  it('lists every package folder exactly once', () => {
    expect([...order].sort()).toEqual([...folders].sort());
  });

  it('names every package @ttt-productions/<folder>, the name the release scripts pass', () => {
    const misnamed = folders.filter((dir) => manifest(dir).name !== `${INTERNAL}${dir}`);
    expect(misnamed).toEqual([]);
  });

  it('places every package after each internal package it declares', () => {
    const early = folders.flatMap((dir) => {
      const declared = manifest(dir);
      return DEPENDENCY_FIELDS.flatMap((field) => Object.keys(declared[field] ?? {}))
        .filter((name) => name.startsWith(INTERNAL))
        .map((name) => name.slice(INTERNAL.length))
        .filter((dep) => !order.includes(dep) || order.indexOf(dep) > order.indexOf(dir))
        .map((dep) => `${dir} before its dependency ${dep}`);
    });
    expect(early, `reorder the root package.json build chain:\n  ${early.join('\n  ')}`).toEqual([]);
  });

  it('release-multiple.sh reads that order and release-all.sh releases through release-multiple.sh', () => {
    const script = (name: string) => readFileSync(join(REPO_ROOT, 'scripts', name), 'utf8');
    expect(script('release-multiple.sh')).toContain('node scripts/package-order.mjs');
    expect(script('release-all.sh')).toContain('./scripts/release-multiple.sh');
  });
});
