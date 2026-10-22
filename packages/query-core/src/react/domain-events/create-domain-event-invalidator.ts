import type { QueryClient } from '@tanstack/react-query';
import {
  applyInvalidations,
  exact,
  prefix,
  predicate,
  type CacheInvalidation,
} from './cache-invalidation.js';

export type DomainEventInvalidationRegistry<TEvent extends { type: string; ids: unknown }> = {
  [K in TEvent['type']]: (
    ids: Extract<TEvent, { type: K }>['ids'],
  ) => ReadonlyArray<CacheInvalidation>;
};

export interface DomainEventInvalidator<TEvent extends { type: string; ids: unknown }> {
  notify(queryClient: QueryClient, event: TEvent): Promise<void>;
  notifyAll(queryClient: QueryClient, events: ReadonlyArray<TEvent>): Promise<void>;
  readonly helpers: {
    exact: typeof exact;
    prefix: typeof prefix;
    predicate: typeof predicate;
  };
  readonly registry: DomainEventInvalidationRegistry<TEvent>;
}

export function createDomainEventInvalidator<TEvent extends { type: string; ids: unknown }>(
  registry: DomainEventInvalidationRegistry<TEvent>,
): DomainEventInvalidator<TEvent> {
  function lookup<TType extends TEvent['type']>(type: TType) {
    return registry[type] as (
      ids: Extract<TEvent, { type: TType }>['ids'],
    ) => ReadonlyArray<CacheInvalidation>;
  }

  function notify(queryClient: QueryClient, event: TEvent): Promise<void> {
    const fn = lookup(event.type as TEvent['type']);
    const invalidations = fn(event.ids as Extract<TEvent, { type: TEvent['type'] }>['ids']);
    return applyInvalidations(queryClient, invalidations);
  }

  function notifyAll(queryClient: QueryClient, events: ReadonlyArray<TEvent>): Promise<void> {
    const all: CacheInvalidation[] = [];
    for (const event of events) {
      const fn = lookup(event.type as TEvent['type']);
      all.push(...fn(event.ids as Extract<TEvent, { type: TEvent['type'] }>['ids']));
    }
    return applyInvalidations(queryClient, all);
  }

  return {
    notify,
    notifyAll,
    helpers: { exact, prefix, predicate },
    registry,
  };
}
