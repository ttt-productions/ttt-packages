// The Firestore guards' pure entry: the write guard's analysis over in-memory sources, the
// test-code path checker, and the Zod introspection both an app's audit tools and the guard use.
// Reading files and installed packages is the `./node` entry's job.

export {
  VIOLATION_KINDS,
  analyzeFiles,
  buildRegistry,
  closedCanonicalKeys,
  createGuardProfile,
  declaredKeys,
  enumerateWriteCallSites,
  evaluate,
  formatReport,
  loadRegistry,
  narrowedDeclaredKeys,
  normalizedArgText,
  numericSentinelSegments,
  packageBuilderArgsMatch,
  packageBuilderReturnKeys,
  packageNameOf,
  parseFile,
  runGuardOnSources,
} from './analyzer.js';
export { findHandTypedFirestorePaths } from './test-paths.js';
export { arrayElement, compositeMembers, kindOf, knownKeys, objectShape, unwrap } from './zod-shape.js';
