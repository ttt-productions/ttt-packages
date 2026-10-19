// The generic guards over an app's core package definitions and the app code that restates them.
// The registry runs every guard listed here; an app supplies each one's facts under its id.

import type { Absent, GenericGuardDefinition } from '../../node/suite/config.js';
import { coreContractsGuard, type CoreContractFacts } from './contracts.js';
import {
  definitionRedeclarationGuard,
  type DefinitionRedeclarationFacts,
} from './redeclaration.js';
import { documentIdSegmentGuard, type DocumentIdSegmentFacts } from './document-id-segment.js';
import {
  schemaLengthLiteralGuard,
  type SchemaLengthLiteralFacts,
} from './schema-length-literal.js';
import {
  singletonBucketAudienceGuard,
  type SingletonBucketAudienceFacts,
} from './singleton-bucket-audience.js';
import {
  textFieldDeclarationsGuard,
  type TextFieldDeclarationFacts,
} from './text-field-declarations.js';

/** The facts each guard in this area needs, by its id. */
export interface CoreDefinitionsGuardFacts {
  definitionRedeclaration: DefinitionRedeclarationFacts;
  coreContracts: CoreContractFacts;
  documentIdSegments: DocumentIdSegmentFacts | Absent;
  schemaLengthLiterals: SchemaLengthLiteralFacts;
  singletonBucketAudience: SingletonBucketAudienceFacts | Absent;
  textFieldDeclarations: TextFieldDeclarationFacts | Absent;
}

export const CORE_DEFINITIONS_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  definitionRedeclarationGuard,
  coreContractsGuard,
  documentIdSegmentGuard,
  schemaLengthLiteralGuard,
  singletonBucketAudienceGuard,
  textFieldDeclarationsGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
