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
import { pagesNeverMoveGuard, type PagesNeverMoveFacts } from './pages-never-move.js';
import { readStateBranchesGuard, type ReadStateBranchFacts } from './read-state-branches.js';
import { readsOnlyWhenShownGuard, type ReadsOnlyWhenShownFacts } from './reads-only-when-shown.js';

export type FrontendReadsGuardFacts = {
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
  readStateBranches: ReadStateBranchFacts;
  pagesNeverMove: PagesNeverMoveFacts;
  readsOnlyWhenShown: ReadsOnlyWhenShownFacts;
};

export const FRONTEND_READS_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  ...READ_FAILURE_GUARDS,
  ...QUERY_KEY_GUARDS,
  ...CACHE_GUARDS,
  readStateBranchesGuard,
  pagesNeverMoveGuard,
  readsOnlyWhenShownGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
