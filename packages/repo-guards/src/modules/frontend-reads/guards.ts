// The generic guards over the client data layer: reads, read failures, query keys, and the cache. The registry runs every guard listed here; an app supplies
// each one's facts under its id.

import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { CACHE_GUARDS, type DomainEventRegistryFacts, type QueryCacheFacts } from './cache.js';
import { QUERY_KEY_GUARDS, type AuthScopedKeyFacts, type QueryKeyFacts } from './query-keys.js';
import {
  READ_FAILURE_GUARDS,
  type DefaultedReadBindingFacts,
  type HookReadDefaultFacts,
  type LaterPageFailureFacts,
  type ReadFailureCopyFacts,
  type ReadRetryStateFacts,
  type ReadStateOwnerFacts,
} from './read-failures.js';

/** The facts each guard in this area needs, by its id. */
export interface FrontendReadsGuardFacts {
  readStateOwner: ReadStateOwnerFacts;
  readRetryState: ReadRetryStateFacts;
  hookReadDefault: HookReadDefaultFacts;
  defaultedReadBinding: DefaultedReadBindingFacts;
  laterPageFailure: LaterPageFailureFacts;
  readFailureCopy: ReadFailureCopyFacts;
  queryKeys: QueryKeyFacts;
  authScopedKeys: AuthScopedKeyFacts;
  queryCache: QueryCacheFacts;
  domainEventRegistry: DomainEventRegistryFacts;
}

export const FRONTEND_READS_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  ...READ_FAILURE_GUARDS,
  ...QUERY_KEY_GUARDS,
  ...CACHE_GUARDS,
] as ReadonlyArray<GenericGuardDefinition<never>>);
