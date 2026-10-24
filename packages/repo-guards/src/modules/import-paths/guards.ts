import type { Absent, GenericGuardDefinition } from '../../node/suite/config.js';
import { applicationDataImportsGuard, type ApplicationDataFacts } from './application-data.js';
import { entryPurityGuard, type EntryPurityFacts } from './entry-purity.js';
import { importPathGuard, type ImportPathFacts } from './guard.js';
import {
  packageEntriesGuard,
  packageEntryImportsGuard,
  type PackageEntryFacts,
  type PackageEntryImportFacts,
} from './package-entries.js';
import {
  packageWildcardImportsGuard,
  type PackageWildcardImportFacts,
} from './package-wildcard-imports.js';
import {
  packageImportCyclesGuard,
  packageImportsGuard,
  type PackageImportFacts,
} from './package-imports.js';

export type ImportPathGuardFacts = {
  importPaths: ImportPathFacts;
  packageEntries: PackageEntryFacts | Absent;
  packageEntryImports: PackageEntryImportFacts;
  packageWildcardImports: PackageWildcardImportFacts;
  packageImports: PackageImportFacts | Absent;
  packageImportCycles: PackageImportFacts | Absent;
  entryPurity: EntryPurityFacts | Absent;
  applicationDataImports: ApplicationDataFacts | Absent;
};

export const IMPORT_PATH_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  importPathGuard,
  packageEntriesGuard,
  packageEntryImportsGuard,
  packageWildcardImportsGuard,
  packageImportsGuard,
  packageImportCyclesGuard,
  entryPurityGuard,
  applicationDataImportsGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
