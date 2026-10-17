// The import-path guard: every definition has exactly one import path.

import type { GenericGuardDefinition } from '../../config.js';
import { importPathGuard, type ImportPathFacts } from './guard.js';

export { unusedIndexMembers, type ImportPathFacts } from './guard.js';

/** The facts each guard in this area needs, by its id. */
export interface ImportPathGuardFacts {
  importPaths: ImportPathFacts;
}

export const IMPORT_PATH_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  importPathGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
