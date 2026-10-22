import { describe, it, expect } from 'vitest';
import {
  assessInvokers,
  hasAllUsersInvoker,
  lines,
} from '../../src/node/tooling/callable-invokers.js';
import {
  compareDeployedFunctions,
  parseLiveFunctions,
  targetedCodebases,
  type LiveFunction,
} from '../../src/node/tooling/deployed-functions.js';
import {
  isDevProject,
  parseFirebaseProjects,
  resolveProject,
} from '../../src/node/tooling/firebase-projects.js';
import {
  assertSafeCors,
  defaultStorageBucket,
  normalizeCors,
  readBucketCors,
} from '../../src/node/tooling/storage-cors.js';

describe('storage CORS', () => {
  const rule = {
    origin: ['https://b.example', 'https://a.example'],
    method: ['HEAD', 'GET'],
    responseHeader: ['Content-Type'],
    maxAgeSeconds: 3600,
  };

  it('two equal policies in a different order normalize equal; a different policy does not', () => {
    const reordered = {
      origin: ['https://a.example', 'https://b.example'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type'],
      maxAgeSeconds: '3600',
    };
    expect(normalizeCors([rule])).toEqual(normalizeCors([reordered]));
    expect(normalizeCors([rule])).not.toEqual(normalizeCors([{ ...rule, maxAgeSeconds: 60 }]));
  });

  it('refuses an empty policy and a wildcard origin before anything is applied', () => {
    expect(() => assertSafeCors([])).toThrow(/at least one rule/);
    expect(() => assertSafeCors({})).toThrow(/at least one rule/);
    expect(() => assertSafeCors([{ ...rule, origin: ['https://*.example'] }])).toThrow(/wildcard/);
    expect(() => assertSafeCors([rule])).not.toThrow();
  });

  it("reads gcloud's cors_config, an absent one as no policy, and refuses an unexpected shape", () => {
    expect(readBucketCors({ cors_config: [rule] })).toEqual([rule]);
    expect(readBucketCors({ name: 'bucket' })).toEqual([]);
    expect(() => readBucketCors([])).toThrow(/unexpected gcloud bucket description/);
    expect(() => readBucketCors({ cors_config: 'x' })).toThrow(/unexpected cors_config shape/);
  });

  it("names a project's default Storage bucket", () => {
    expect(defaultStorageBucket('demo-dev')).toBe('demo-dev.firebasestorage.app');
  });
});

describe('callable invokers', () => {
  const PUBLIC = { bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }] };

  it('holds only for allUsers on roles/run.invoker', () => {
    expect(hasAllUsersInvoker(PUBLIC)).toBe(true);
    expect(
      hasAllUsersInvoker({
        bindings: [{ role: 'roles/run.invoker', members: ['allAuthenticatedUsers'] }],
      }),
    ).toBe(false);
    expect(
      hasAllUsersInvoker({ bindings: [{ role: 'roles/run.viewer', members: ['allUsers'] }] }),
    ).toBe(false);
    expect(hasAllUsersInvoker({})).toBe(false);
  });

  it('passes when every service is public and names one missing the binding', () => {
    expect(
      assessInvokers(
        ['a', 'b'],
        new Map([
          ['a', PUBLIC],
          ['b', PUBLIC],
        ]),
      ),
    ).toEqual({ missing: [], unreadable: [], empty: false });
    expect(
      assessInvokers(
        ['a', 'b'],
        new Map([
          ['a', PUBLIC],
          ['b', { bindings: [] }],
        ]),
      ).missing,
    ).toEqual(['b']);
  });

  it('fails closed on a policy it could not read, and on one it never read', () => {
    expect(
      assessInvokers(['a', 'b'], new Map([['a', new Error('PERMISSION_DENIED')]])).unreadable,
    ).toEqual(['a (PERMISSION_DENIED)', 'b (no policy read)']);
  });

  it('marks a check that found nothing, so it never passes on nothing', () => {
    expect(assessInvokers([], new Map()).empty).toBe(true);
  });

  it('reads gcloud value output line by line, carriage returns stripped', () => {
    expect(lines('a\r\nb\r\n\r\n')).toEqual(['a', 'b']);
  });
});

describe('deployed functions', () => {
  const fn = (name: string, codebase: string | null, state = 'ACTIVE'): LiveFunction => ({
    name,
    codebase,
    state,
  });
  const EXPECTED = [
    { codebase: 'interactive', names: ['registerUser', 'recordSignIn'] },
    { codebase: 'admin', names: ['updateConfig'] },
  ];

  it('passes when every expected function is live and ACTIVE and nothing else is', () => {
    const live = [
      fn('registerUser', 'interactive'),
      fn('recordSignIn', 'interactive'),
      fn('updateConfig', 'admin'),
    ];
    expect(compareDeployedFunctions(EXPECTED, live)).toEqual({
      missing: [],
      leftover: [],
      notActive: [],
    });
  });

  it('fails a deploy whose CLI dropped a create and still exited 0', () => {
    const live = [fn('registerUser', 'interactive'), fn('updateConfig', 'admin')];
    expect(compareDeployedFunctions(EXPECTED, live).missing).toEqual(['interactive:recordSignIn']);
  });

  it('fails a deploy that left a removed function deployed, or one not ACTIVE', () => {
    const live = [
      fn('registerUser', 'interactive'),
      fn('recordSignIn', 'interactive', 'FAILED'),
      fn('oldFn', 'interactive'),
      fn('updateConfig', 'admin'),
    ];
    expect(compareDeployedFunctions(EXPECTED, live)).toEqual({
      missing: [],
      leftover: ['interactive:oldFn'],
      notActive: ['interactive:recordSignIn (FAILED)'],
    });
  });

  it('checks only the targeted codebases', () => {
    const live = [
      fn('registerUser', 'interactive'),
      fn('recordSignIn', 'interactive'),
      fn('stale', 'admin'),
    ];
    expect(compareDeployedFunctions([EXPECTED[0]!], live)).toEqual({
      missing: [],
      leftover: [],
      notActive: [],
    });
  });

  it('an app with one unnamed codebase compares every function live in the region', () => {
    const live = [fn('a', null), fn('b', 'default'), fn('extra', null)];
    expect(compareDeployedFunctions([{ codebase: null, names: ['a', 'b'] }], live)).toEqual({
      missing: [],
      leftover: ['extra'],
      notActive: [],
    });
  });

  it('parses gcloud rows into name, codebase, and state', () => {
    expect(
      parseLiveFunctions([
        {
          name: 'projects/p/locations/r/functions/registerUser',
          state: 'ACTIVE',
          labels: {
            'firebase-functions-codebase': 'interactive',
            'deployment-tool': 'cli-firebase',
          },
        },
        { name: 'projects/p/locations/r/functions/hand', labels: {} },
      ]),
    ).toEqual([
      { name: 'registerUser', codebase: 'interactive', state: 'ACTIVE' },
      { name: 'hand', codebase: null, state: 'UNKNOWN' },
    ]);
  });

  it('reads a deploy selection, and refuses one it cannot read rather than checking nothing', () => {
    const all = ['interactive', 'admin'];
    expect(targetedCodebases('functions', all)).toEqual(all);
    expect(targetedCodebases('none', all)).toEqual([]);
    expect(targetedCodebases('functions:admin,functions:admin', all)).toEqual(['admin']);
    expect(() => targetedCodebases('functions:unknown', all)).toThrow(
      /Unreadable functions selection/,
    );
    expect(() => targetedCodebases('', all)).toThrow(/Unreadable functions selection/);
  });
});

describe('firebase projects', () => {
  const projects = parseFirebaseProjects(
    JSON.stringify({ projects: { dev: 'demo-dev', prod: 'demo-prod' } }),
  );

  it('reads the dev and prod aliases, and refuses a .firebaserc without both', () => {
    expect(projects).toEqual({ dev: 'demo-dev', prod: 'demo-prod' });
    expect(() => parseFirebaseProjects(JSON.stringify({ projects: { dev: 'demo-dev' } }))).toThrow(
      /no dev and prod/,
    );
  });

  it('resolves an alias or an id, and refuses a missing or unknown project', () => {
    expect(resolveProject('dev', projects)).toBe('demo-dev');
    expect(resolveProject('demo-prod', projects)).toBe('demo-prod');
    expect(() => resolveProject(undefined, projects)).toThrow(/--project is required/);
    expect(() => resolveProject('other', projects)).toThrow(/not a project in .firebaserc/);
  });

  it('knows the dev project', () => {
    expect(isDevProject('demo-dev', projects)).toBe(true);
    expect(isDevProject('demo-prod', projects)).toBe(false);
  });
});
