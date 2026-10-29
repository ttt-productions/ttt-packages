import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLOW_TEST_TIMEOUT_MS } from '../../../test/timeouts.js';

const ADMIN_INIT = path.resolve(import.meta.dirname, '../src/server/admin-init.ts');

// A fresh process: this suite's own imports would already have loaded the modules under test.
const PROBE = `
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const cache = createRequire(process.argv[1]).cache;
const loaded = (dir) =>
  Object.keys(cache).some((file) => file.split(path.sep).join('/').includes('/firebase-admin/lib/' + dir + '/'));
const { getAdminApp } = await import(pathToFileURL(process.argv[1]).href);
const handles = getAdminApp({ projectId: 'demo-lazy-load' });
void handles.db;
const afterDb = { auth: loaded('auth'), storage: loaded('storage') };
const auth = handles.auth;
const storage = handles.storage;
console.log(JSON.stringify({
  afterDb,
  afterRead: { auth: loaded('auth'), storage: loaded('storage') },
  authWorks: typeof auth.getUser === 'function',
  storageWorks: typeof storage.bucket === 'function',
}));
`;

interface ProbeResult {
  afterDb: { auth: boolean; storage: boolean };
  afterRead: { auth: boolean; storage: boolean };
  authWorks: boolean;
  storageWorks: boolean;
}

function runProbe(): ProbeResult {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', PROBE, ADMIN_INIT], {
    encoding: 'utf8',
  });
  return JSON.parse(output) as ProbeResult;
}

describe('getAdminApp module loading', () => {
  it(
    'loads neither Auth nor Storage for a caller that reads only db, and loads each on first read',
    () => {
      const result = runProbe();
      expect(result.afterDb).toEqual({ auth: false, storage: false });
      expect(result.afterRead).toEqual({ auth: true, storage: true });
      expect(result.authWorks).toBe(true);
      expect(result.storageWorks).toBe(true);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
