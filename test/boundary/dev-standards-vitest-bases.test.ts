import { describe, expect, it } from 'vitest';
import {
  createAppVitestConfig,
  createFunctionsVitestConfig,
  createRulesVitestConfig,
} from '@ttt-productions/dev-standards/node/vitest';
import { REPO_ROOT } from './leak-utils';
import { packageSource } from './workspace';

const STANDARDS_SOURCE = /^packages\/dev-standards\/src\//;
const CONCURRENT = /\bconcurrent\b/;

function concurrentKeys(value: unknown, path = 'test'): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, i) => concurrentKeys(item, `${path}[${i}]`));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(key === 'concurrent' ? [`${path}.${key}`] : []),
    ...concurrentKeys(child, `${path}.${key}`),
  ]);
}

const bases = {
  app: await createAppVitestConfig({ root: REPO_ROOT }),
  functions: createFunctionsVitestConfig(),
  rules: createRulesVitestConfig({ root: REPO_ROOT }),
};

describe('no dev-standards Vitest base runs the tests of a file concurrently', () => {
  it('every base it builds leaves concurrent unset, in its own test settings and in every project', () => {
    const found = Object.entries(bases).flatMap(([name, config]) =>
      concurrentKeys(config.test).map((key) => `${name}: ${key}`),
    );
    expect(found).toEqual([]);
  });

  it('no dev-standards config source names concurrent, so a base added later cannot set it', () => {
    const offenders = packageSource(['code'])
      .filter((file) => STANDARDS_SOURCE.test(file.path))
      .filter((file) => CONCURRENT.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('the settings check finds concurrent wherever a base could set it', () => {
    expect(concurrentKeys({ sequence: { concurrent: true } })).toEqual([
      'test.sequence.concurrent',
    ]);
    expect(concurrentKeys({ projects: [{ test: { concurrent: false } }] })).toEqual([
      'test.projects[0].test.concurrent',
    ]);
  });
});
