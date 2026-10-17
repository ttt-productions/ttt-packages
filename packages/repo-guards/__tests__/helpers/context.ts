// A guard context over a reader, as the suite builds one, for tests that run a guard directly.

import type { GuardContext } from '../../src/guard.js';
import type { RepoReader } from '../../src/reader/reader.js';

export const contextOf = (reader: RepoReader): GuardContext => ({
  reader,
  files: (scope) => reader.files(scope),
  file: (relPath) => reader.file(relPath),
});
