import type { QueryClient } from "@tanstack/react-query";
import {
  applyInvalidations,
  exact,
  prefix,
  predicate,
  type CacheInvalidation,
} from "./cache-invalidation.js";

/**
 * Registry shape: each event type maps to a function from the event's `ids`
 * payload to the list of cache invalidations that event should trigger.
 */
export type DomainEventInvalidationRegistry<TEvent extends { type: string; ids: unknown }> = {
  [K in TEvent["type"]]: (
    ids: Extract<TEvent, { type: K }>["ids"],
  ) => ReadonlyArray<CacheInvalidation>;
};

export interface DomainEventInvalidator<TEvent extends { type: string; ids: unknown }> {
  notify(queryClient: QueryClient, event: TEvent): void;
  notifyAll(queryClient: QueryClient, events: ReadonlyArray<TEvent>): void;
  /** Test/debug helpers. */
  readonly helpers: {
    exact: typeof exact;
    prefix: typeof prefix;
    predicate: typeof predicate;
  };
  /** Direct access to the registry, mainly for tests. */
  readonly registry: DomainEventInvalidationRegistry<TEvent>;
}

/**
 * Build a domain-event → cache-invalidation notifier from a typed registry.
 * The registry's keys are statically tied to `TEvent["type"]`, so missing or
 * extra entries are compile errors.
 */
export function createDomainEventInvalidator<TEvent extends { type: string; ids: unknown }>(
  registry: DomainEventInvalidationRegistry<TEvent>,
): DomainEventInvalidator<TEvent> {
  function lookup<TType extends TEvent["type"]>(type: TType) {
    return registry[type] as (
      ids: Extract<TEvent, { type: TType }>["ids"],
    ) => ReadonlyArray<CacheInvalidation>;
  }

  function notify(queryClient: QueryClient, event: TEvent): void {
    const fn = lookup(event.type as TEvent["type"]);
    const invalidations = fn(event.ids as Extract<TEvent, { type: TEvent["type"] }>["ids"]);
    applyInvalidations(queryClient, invalidations);
  }

  function notifyAll(queryClient: QueryClient, events: ReadonlyArray<TEvent>): void {
    const all: CacheInvalidation[] = [];
    for (const event of events) {
      const fn = lookup(event.type as TEvent["type"]);
      all.push(...fn(event.ids as Extract<TEvent, { type: TEvent["type"] }>["ids"]));
    }
    applyInvalidations(queryClient, all);
  }

  return {
    notify,
    notifyAll,
    helpers: { exact, prefix, predicate },
    registry,
  };
}
