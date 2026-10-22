import type { GuardContext } from '../../src/guard.js';
import type { RepoReader } from '../../src/node/reader.js';

export const contextOf = (reader: RepoReader): GuardContext => ({
  reader,
  files: (scope) => reader.files(scope),
  file: (relPath) => reader.file(relPath),
  rulesFiles: (service) => reader.rulesFiles(service),
});
