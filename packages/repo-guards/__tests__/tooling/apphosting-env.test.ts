import { describe, it, expect } from 'vitest';
import {
  AppHostingConfigError,
  BASE_CONFIG,
  PRODUCTION_CONFIG,
  buildEnvFromConfigs,
  configFilesFor,
  isBuildAvailable,
  mergeEnv,
  parseConfig,
  type BuildSecretSkip,
} from '../../src/node/tooling/apphosting-env.js';

const cfg = (text: string, label = 'apphosting.yaml') => ({ text, label });

const SKIPS: BuildSecretSkip[] = [
  {
    variable: 'UPLOAD_TOKEN',
    why: 'a build-time upload credential whose absence only skips the upload',
  },
];

const BASE = `
env:
  - variable: PUBLIC_SITE_URL
    value: "https://dev.example.com"
    availability: [BUILD, RUNTIME]
  - variable: PUBLIC_AUTO_SEND
    value: "false"
    availability: [BUILD, RUNTIME]
  - variable: COOKIE_DOMAIN
    value: "dev.example.com"
    availability: [RUNTIME]
  - variable: SESSION_SECRET
    secret: SESSION_SECRET
    availability: [RUNTIME]
`;

const OVERLAY = `
env:
  - variable: PUBLIC_SITE_URL
    value: "https://example.com"
    availability: [BUILD, RUNTIME]
  - variable: PUBLIC_AUTO_SEND
    value: "true"
    availability: [BUILD, RUNTIME]
`;

describe('environment selection', () => {
  it('develop reads the base config only; production reads base + overlay in merge order', () => {
    expect(configFilesFor('develop')).toEqual([BASE_CONFIG]);
    expect(configFilesFor('production')).toEqual([BASE_CONFIG, PRODUCTION_CONFIG]);
    expect(() => configFilesFor('staging')).toThrow(AppHostingConfigError);
  });
});

describe('availability rules', () => {
  it('exports BUILD-available values and omits RUNTIME-only ones', () => {
    const env = buildEnvFromConfigs([cfg(BASE)], SKIPS);
    expect(env.PUBLIC_SITE_URL).toBe('https://dev.example.com');
    expect(env).not.toHaveProperty('COOKIE_DOMAIN');
    expect(env).not.toHaveProperty('SESSION_SECRET');
  });

  it("treats an OMITTED availability as build-available (App Hosting's BUILD + RUNTIME default)", () => {
    expect(isBuildAvailable({ variable: 'X' })).toBe(true);
    expect(isBuildAvailable({ variable: 'X', availability: null })).toBe(true);
    expect(isBuildAvailable({ variable: 'X', availability: ['RUNTIME'] })).toBe(false);
    const env = buildEnvFromConfigs(
      [cfg('env:\n  - variable: OMITTED\n    value: "kept"\n')],
      SKIPS,
    );
    expect(env.OMITTED).toBe('kept');
  });

  it('keeps exact string values: a quoted "false" never becomes a boolean', () => {
    expect(buildEnvFromConfigs([cfg(BASE)], SKIPS).PUBLIC_AUTO_SEND).toBe('false');
  });

  it('stringifies an unquoted scalar rather than exporting a non-string', () => {
    const env = buildEnvFromConfigs(
      [cfg('env:\n  - variable: MAX_THINGS\n    value: 10\n    availability: [BUILD]\n')],
      SKIPS,
    );
    expect(env.MAX_THINGS).toBe('10');
  });
});

describe('production merge semantics', () => {
  it('the overlay wins PER KEYED VARIABLE and base-only variables survive', () => {
    const env = buildEnvFromConfigs([cfg(BASE), cfg(OVERLAY, PRODUCTION_CONFIG)], SKIPS);
    expect(env.PUBLIC_SITE_URL).toBe('https://example.com');
    expect(env.PUBLIC_AUTO_SEND).toBe('true');
  });

  it('an overlay entry that omits availability re-arms its variable for the build, and a secret then fails closed', () => {
    expect(() =>
      buildEnvFromConfigs(
        [
          cfg(BASE),
          cfg('env:\n  - variable: SESSION_SECRET\n    secret: SESSION_SECRET\n', 'overlay'),
        ],
        SKIPS,
      ),
    ).toThrow(/BUILD-available secret/);
  });

  it('merge keeps the base ordering and appends overlay-only variables', () => {
    const merged = mergeEnv(
      parseConfig(BASE, 'base'),
      parseConfig(`${OVERLAY}  - variable: ONLY_PROD\n    value: "p"\n`, 'overlay'),
    );
    expect(merged.map((e) => e.variable)).toEqual([
      'PUBLIC_SITE_URL',
      'PUBLIC_AUTO_SEND',
      'COOKIE_DOMAIN',
      'SESSION_SECRET',
      'ONLY_PROD',
    ]);
  });
});

describe('fail-closed and malformed configs', () => {
  it('a BUILD-available secret reference fails closed, explicitly or through omitted availability', () => {
    expect(() =>
      buildEnvFromConfigs(
        [
          cfg(
            'env:\n  - variable: SOME_SECRET\n    secret: SOME_SECRET\n    availability: [BUILD, RUNTIME]\n',
          ),
        ],
        SKIPS,
      ),
    ).toThrow(AppHostingConfigError);
    expect(() =>
      buildEnvFromConfigs(
        [cfg('env:\n  - variable: SOME_SECRET\n    secret: SOME_SECRET\n')],
        SKIPS,
      ),
    ).toThrow(/SOME_SECRET/);
  });

  it('a named skip is left out, not exported, and not an error', () => {
    const env = buildEnvFromConfigs(
      [
        cfg(
          'env:\n  - variable: UPLOAD_TOKEN\n    secret: UPLOAD_TOKEN\n    availability: [BUILD]\n  - variable: KEPT\n    value: "v"\n',
        ),
      ],
      SKIPS,
    );
    expect(env).toEqual({ KEPT: 'v' });
  });

  it('skips are by NAME, never a category: an unlisted BUILD secret beside a skipped one still fails', () => {
    expect(() =>
      buildEnvFromConfigs(
        [
          cfg(
            'env:\n  - variable: UPLOAD_TOKEN\n    secret: UPLOAD_TOKEN\n  - variable: OTHER_SECRET\n    secret: OTHER_SECRET\n',
          ),
        ],
        SKIPS,
      ),
    ).toThrow(/OTHER_SECRET/);
  });

  it('with no skips, every BUILD secret fails closed', () => {
    expect(() =>
      buildEnvFromConfigs(
        [cfg('env:\n  - variable: UPLOAD_TOKEN\n    secret: UPLOAD_TOKEN\n')],
        [],
      ),
    ).toThrow(/UPLOAD_TOKEN/);
  });

  it('duplicate variable names WITHIN one file are an error; across base and overlay they merge', () => {
    expect(() =>
      parseConfig(
        'env:\n  - variable: DUP\n    value: "a"\n  - variable: DUP\n    value: "b"\n',
        'apphosting.yaml',
      ),
    ).toThrow(/duplicate 'variable' DUP/);
    expect(() => buildEnvFromConfigs([cfg(BASE), cfg(OVERLAY, 'overlay')], SKIPS)).not.toThrow();
  });

  it('rejects malformed configs with a clear error', () => {
    expect(() => parseConfig('env:\n  -\n   - broken: [', 'bad.yaml')).toThrow(
      AppHostingConfigError,
    );
    expect(() => parseConfig('- just\n- a\n- list\n', 'bad.yaml')).toThrow(
      /top level must be a mapping/,
    );
    expect(() => parseConfig('env: not-a-list\n', 'bad.yaml')).toThrow(/'env' must be a list/);
    expect(() => parseConfig('env:\n  - value: "orphan"\n', 'bad.yaml')).toThrow(
      /missing 'variable'/,
    );
    expect(() =>
      parseConfig('env:\n  - variable: BOTH\n    value: "v"\n    secret: S\n', 'bad.yaml'),
    ).toThrow(/exactly one of/);
    expect(() => parseConfig('env:\n  - variable: NEITHER\n', 'bad.yaml')).toThrow(
      /exactly one of/,
    );
    expect(() =>
      buildEnvFromConfigs(
        [cfg('env:\n  - variable: X\n    value: "v"\n    availability: BUILD\n')],
        SKIPS,
      ),
    ).toThrow(/availability must be a list/);
  });

  it('an empty or env-less config yields no build variables', () => {
    expect(parseConfig('', 'empty.yaml')).toEqual([]);
    expect(parseConfig('runConfig:\n  cpu: 1\n', 'no-env.yaml')).toEqual([]);
  });
});
