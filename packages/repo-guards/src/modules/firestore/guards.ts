// The generic guards over Firestore and Storage access. The registry runs every guard listed here; an
// app supplies each one's facts under its id.

import type { Absent, GenericGuardDefinition } from '../../node/suite/config.js';
import { firestoreRuntimeInUiGuard, liveSubscriptionGuard, type FirestoreRuntimeInUiFacts, type LiveSubscriptionFacts } from './client-guards.js';
import { testPathGuard, writeGuard, type TestPathFacts, type WriteGuardFacts } from './guard.js';
import { collectionGroupIndexGuard, type CollectionGroupIndexFacts } from './index-guard.js';
import {
  literalSegmentGuard,
  pathAssemblyGuard,
  retiredSegmentGuard,
  type PathAssemblyFacts,
  type RetiredSegmentFacts,
} from './path-guards.js';
import { rulesClaimGuard, type RulesClaimFacts } from './rules-claim-guard.js';
import { rulesMirrorGuard, type RulesMirrorFacts } from './rules-mirror-guard.js';
import { counterDecrementGuard, randomUuidGuard, timestampNowGuard, transactionReadGuard, type RandomUuidFacts } from './server-guards.js';
import {
  storageObjectMetadataGuard,
  storageUploadOriginGuard,
  type StorageObjectMetadataFacts,
  type StorageUploadOriginFacts,
} from './storage-guards.js';
import type { NoFacts } from './support.js';


/** The facts each guard in this area needs, by its id. */
export interface FirestoreGuardFacts {
  firestoreWrites: WriteGuardFacts | Absent;
  firestoreTestPaths: TestPathFacts | Absent;
  firestoreLiteralSegments: NoFacts | Absent;
  firestorePathAssembly: PathAssemblyFacts | Absent;
  firestoreRetiredSegments: RetiredSegmentFacts | Absent;
  firestoreCollectionGroupIndexes: CollectionGroupIndexFacts | Absent;
  storageUploadOrigins: StorageUploadOriginFacts | Absent;
  storageObjectMetadata: StorageObjectMetadataFacts | Absent;
  firestoreTransactionReads: NoFacts | Absent;
  firestoreCounterDecrements: NoFacts | Absent;
  firestoreLiveSubscriptions: LiveSubscriptionFacts | Absent;
  firestoreRuntimeInUi: FirestoreRuntimeInUiFacts | Absent;
  firestoreRandomUuidSites: RandomUuidFacts | Absent;
  firestoreTimestampNow: NoFacts | Absent;
  rulesClaimNames: RulesClaimFacts;
  rulesMirrorCore: RulesMirrorFacts;
}

export const FIRESTORE_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  writeGuard,
  testPathGuard,
  literalSegmentGuard,
  pathAssemblyGuard,
  retiredSegmentGuard,
  collectionGroupIndexGuard,
  storageUploadOriginGuard,
  storageObjectMetadataGuard,
  transactionReadGuard,
  counterDecrementGuard,
  liveSubscriptionGuard,
  firestoreRuntimeInUiGuard,
  randomUuidGuard,
  timestampNowGuard,
  rulesClaimGuard,
  rulesMirrorGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
