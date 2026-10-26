import { vi } from 'vitest';
import type { SentrySdkLike } from '../../src/adapters/create-sentry-adapter.js';
import type { ScopeLike } from '../../src/types.js';

export function sentrySdkFake() {
  const scope = {
    setTag: vi.fn<ScopeLike['setTag']>(),
    setUser: vi.fn<ScopeLike['setUser']>(),
    setExtra: vi.fn<ScopeLike['setExtra']>(),
    setContext: vi.fn<ScopeLike['setContext']>(),
    setLevel: vi.fn<NonNullable<ScopeLike['setLevel']>>(),
  };
  const sdk = {
    init: vi.fn<SentrySdkLike['init']>(),
    captureException: vi.fn<SentrySdkLike['captureException']>(),
    captureMessage: vi.fn<SentrySdkLike['captureMessage']>(),
    setUser: vi.fn<SentrySdkLike['setUser']>(),
    setTag: vi.fn<SentrySdkLike['setTag']>(),
    withScope: vi.fn<NonNullable<SentrySdkLike['withScope']>>((fn) => fn(scope)),
    addBreadcrumb: vi.fn<NonNullable<SentrySdkLike['addBreadcrumb']>>(),
  } satisfies SentrySdkLike;
  return { sdk, scope };
}
