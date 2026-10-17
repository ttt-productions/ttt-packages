// The Node entry: the one reader, for anything that reads an app's repository outside the suite
// (a hand-run report, a tooling script).

export { createRepoReader, layoutProblems, type RepoReader, type Scope } from '../reader/reader.js';
export {
  FILE_KINDS,
  ROOT_ROLES,
  isTestPath,
  kindOfFile,
  type FileKind,
  type RepoLayout,
  type Reviewed,
  type RootDeclaration,
  type RootRole,
} from '../reader/layout.js';
