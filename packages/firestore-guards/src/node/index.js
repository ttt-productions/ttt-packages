// The Node half of the guards: everything that reads the file system — walking an app's trees,
// reading the installed packages a write guard consults — around the pure analysis in the root.

import fs from 'node:fs';
import path from 'node:path';
import { analyzeFiles, enumerateWriteCallSites, evaluate, parseFile } from '../analyzer.js';

const SOURCE_EXT = /\.(ts|tsx|mts|cts|mjs|cjs|js)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts|mjs|cjs|js)$/;
const DECLARATION_FILE = /\.d\.ts$/;

const toRel = (repoRoot, full) => path.relative(repoRoot, full).split(path.sep).join('/');

/**
 * Every non-test source file under `root`, repo-root-relative and forward-slashed.
 * Test trees and dependency/build directories are never source.
 *
 * @param {string} repoRoot
 * @param {string} root repo-relative folder to walk
 * @param {{ excludePaths?: string[] }} [options]
 * @returns {string[]}
 */
export function collectSourceFiles(repoRoot, root, { excludePaths = [] } = {}) {
  const excluded = new Set(excludePaths);
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = toRel(repoRoot, full);
      if (entry.isDirectory()) {
        // A `__tests__` DIRECTORY is not skipped: non-test files live in these trees
        // (shared fixtures, rules-suite setup) and skipping the folder wholesale made them
        // invisible. Only files whose NAME says they are tests are skipped, below.
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        if (entry.name.startsWith('.')) continue;
        if (excluded.has(rel)) continue;
        walk(full);
      } else if (
        SOURCE_EXT.test(entry.name) &&
        !TEST_FILE.test(entry.name) &&
        !DECLARATION_FILE.test(entry.name) &&
        !entry.name.startsWith('.') &&
        !excluded.has(rel)
      ) {
        results.push(rel);
      }
    }
  };
  walk(path.join(repoRoot, root));
  return results.sort();
}

/**
 * The reader `analyzeFiles` takes for installed packages' type declarations: every shipped
 * `.d.ts` file under `node_modules/<packageName>` of `repoRoot`.
 *
 * @param {string} repoRoot
 * @returns {(packageName: string) => Array<{ file: string, text: string }>}
 */
export function nodePackageDeclarations(repoRoot) {
  return (packageName) => {
    const root = path.join(repoRoot, 'node_modules', ...packageName.split('/'));
    const files = [];
    const walk = (dir, depth) => {
      if (depth > 6) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full, depth + 1);
          continue;
        }
        if (!DECLARATION_FILE.test(entry.name)) continue;
        try {
          files.push({ file: full, text: fs.readFileSync(full, 'utf8') });
        } catch {
          // An unreadable declaration file simply contributes nothing.
        }
      }
    };
    walk(root, 0);
    return files;
  };
}

/**
 * Analyze an app's local Firestore writer trees.
 *
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {string[]} options.trees repo-relative roots to sweep for writes
 * @param {object} options.registry from loadRegistry()
 * @param {object} options.profile from createGuardProfile()
 * @param {string[]} [options.libraryTrees] repo-relative roots read for what they declare and
 *   return, never swept; defaults to the profile's core library root
 * @param {Array} [options.exceptions] the reviewed exception list
 * @param {Array<string | { path: string }>} [options.excludePaths] repo-relative paths never scanned
 */
export function runGuard({ repoRoot, trees, registry, profile, libraryTrees, exceptions = [], excludePaths = [] }) {
  const paths = excludePaths.map((entry) => (typeof entry === 'string' ? entry : entry.path));
  const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
  const files = [];
  for (const tree of trees) {
    for (const rel of collectSourceFiles(repoRoot, tree, { excludePaths: paths })) files.push(parseFile(rel, read(rel)));
  }
  const libraryFiles = [];
  for (const tree of libraryTrees ?? (profile.coreLibraryRoot ? [profile.coreLibraryRoot] : [])) {
    for (const rel of collectSourceFiles(repoRoot, tree)) libraryFiles.push(parseFile(rel, read(rel), { library: true }));
  }
  const { writes, notFirestore, unclassified, packageBuilderUses } = analyzeFiles({
    files,
    libraryFiles,
    registry,
    profile,
    exceptions,
    packageDeclarations: nodePackageDeclarations(repoRoot),
  });
  const evaluated = evaluate({
    writes,
    registry,
    exceptions,
    trees,
    notFirestore,
    unclassified,
    packageBuilderUses,
    callSites: enumerateWriteCallSites(files),
  });
  // An exclusion that no longer names anything on disk is the same latent licence a stale
  // exception is: it sits there ready to hide the next tree that appears at that path.
  const staleExclusions = paths.filter((rel) => !fs.existsSync(path.join(repoRoot, rel)));
  return { ...evaluated, writes, notFirestore, unclassified, staleExclusions, fileCount: files.length };
}

/**
 * Every test-code file under the given roots, read: a file whose name says it is a test, or any
 * file under a test tree — a folder named `__tests__`, one of `testTrees`, or a root passed with
 * `whole: true`.
 *
 * @param {string} repoRoot
 * @param {Array<{ root: string, whole?: boolean }>} roots repo-relative roots
 * @param {{ testTrees?: string[] }} [options] repo-relative folders whose every file is test code
 * @returns {Array<{ path: string, content: string }>}
 */
export function collectTestCode(repoRoot, roots, { testTrees = [] } = {}) {
  const trees = new Set(testTrees);
  const results = [];
  const walk = (dir, inTestTree) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        walk(full, inTestTree || entry.name === '__tests__' || trees.has(toRel(repoRoot, full)));
      } else if (SOURCE_EXT.test(entry.name) && !DECLARATION_FILE.test(entry.name) && (inTestTree || TEST_FILE.test(entry.name))) {
        results.push({ path: toRel(repoRoot, full), content: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  for (const { root, whole = false } of roots) walk(path.join(repoRoot, root), whole);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}
