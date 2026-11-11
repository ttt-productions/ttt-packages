import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';
import { REPO_ROOT } from './leak-utils';

type Manifest = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const ZERO = '@ttt-productions/zero';
const MINOR = '@ttt-productions/minor';
const MAJOR = '@ttt-productions/major';

const consumer = (name: string): Manifest => ({
  name,
  version: '0.3.1',
  dependencies: { [ZERO]: '*', [MINOR]: '*', other: '^2.0.0' },
  peerDependencies: { [ZERO]: '*' },
  devDependencies: { [MAJOR]: '*' },
  optionalDependencies: { [ZERO]: '*', [MINOR]: '*' },
});

const root = mkdtempSync(join(tmpdir(), 'pin-internal-deps-'));
mkdirSync(join(root, 'scripts'));
copyFileSync(
  join(REPO_ROOT, 'scripts', 'pin-internal-deps.mjs'),
  join(root, 'scripts', 'pin-internal-deps.mjs'),
);
const manifests: Record<string, Manifest> = {
  zero: { name: ZERO, version: '0.0.2' },
  minor: { name: MINOR, version: '0.11.44' },
  major: { name: MAJOR, version: '1.6.21' },
  pinned: consumer('@ttt-productions/pinned'),
  unpinned: consumer('@ttt-productions/unpinned'),
  'optional-unpinned': {
    name: '@ttt-productions/optional-unpinned',
    version: '0.3.1',
    optionalDependencies: { [ZERO]: '*' },
  },
};
for (const [dir, manifest] of Object.entries(manifests)) {
  mkdirSync(join(root, 'packages', dir), { recursive: true });
  writeFileSync(join(root, 'packages', dir, 'package.json'), JSON.stringify(manifest, null, 2));
}

const pin = (dir: string, ...flags: string[]) =>
  spawnSync(process.execPath, ['scripts/pin-internal-deps.mjs', `packages/${dir}`, ...flags], {
    cwd: root,
    encoding: 'utf8',
  });

const pinRun = pin('pinned');
const result = JSON.parse(
  readFileSync(join(root, 'packages', 'pinned', 'package.json'), 'utf8'),
) as Manifest;
const zeroRange = result.dependencies?.[ZERO] ?? '';

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('boundary: publish pinning keeps every internal patch inside its dependents’ ranges', () => {
  it('pins an internal dependency at 0.0.z as >=0.0.z <0.1.0, in dependencies and peerDependencies', () => {
    expect(pinRun.status).toBe(0);
    expect(result.dependencies?.[ZERO]).toBe('>=0.0.2 <0.1.0');
    expect(result.peerDependencies?.[ZERO]).toBe('>=0.0.2 <0.1.0');
  });

  it('the 0.0.z range accepts that version and every later 0.0.x patch', () => {
    for (const version of ['0.0.2', '0.0.3', '0.0.99']) {
      expect(semver.satisfies(version, zeroRange), version).toBe(true);
    }
  });

  it('the 0.0.z range refuses 0.1.0, anything above it, and anything below 0.0.z', () => {
    for (const version of ['0.1.0', '1.0.0', '0.0.1', '0.0.0']) {
      expect(semver.satisfies(version, zeroRange), version).toBe(false);
    }
  });

  it('pins an internal dependency at 0.y.z with y > 0, and at 1.y.z, as a caret', () => {
    expect(result.dependencies?.[MINOR]).toBe('^0.11.44');
    expect(result.devDependencies?.[MAJOR]).toBe('^1.6.21');
  });

  it('pins an internal "*" in optionalDependencies by the same rule', () => {
    expect(result.optionalDependencies?.[ZERO]).toBe('>=0.0.2 <0.1.0');
    expect(result.optionalDependencies?.[MINOR]).toBe('^0.11.44');
  });

  it('leaves a non-internal range as written', () => {
    expect(result.dependencies?.other).toBe('^2.0.0');
  });

  it('--check passes on the pinned manifest', () => {
    expect(pin('pinned', '--check').status).toBe(0);
  });

  it('--check fails on a manifest that still holds an internal "*"', () => {
    const check = pin('unpinned', '--check');
    expect(check.status).toBe(1);
    expect(check.stderr).toContain(`dependencies › ${ZERO}`);
  });

  it('--check fails on an internal "*" left in optionalDependencies', () => {
    const check = pin('optional-unpinned', '--check');
    expect(check.status).toBe(1);
    expect(check.stderr).toContain(`optionalDependencies › ${ZERO}`);
  });
});
