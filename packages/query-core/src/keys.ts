/**
 * Lightweight, stable query key helpers.
 *
 * Convention:
 * - `keys.user.all` => ['user']
 * - `keys.user.detail(id)` => ['user', 'detail', id]
 * - `keys.user.list(filters?)` => ['user', 'list', filters]
 */

type KeyPart = string | number | boolean | null | undefined | Record<string, unknown>;
export type QueryKey = readonly unknown[];

function withScope(scope: string, ...parts: KeyPart[]): QueryKey {
  const cleaned = parts.filter((p) => p !== undefined);
  return [scope, ...cleaned] as const;
}

export const keys = {
  user: {
    all: withScope('user'),
    detail: (id: string) => withScope('user', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('user', 'list', params),
  },
  project: {
    all: withScope('project'),
    detail: (id: string) => withScope('project', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('project', 'list', params),
  },
} as const;

/**
 * Utility for apps that want to define their own scoped key sets
 * while following the same conventions.
 */
export function createKeyScope(scope: string) {
  return {
    all: withScope(scope),
    detail: (id: string) => withScope(scope, 'detail', id),
    list: (params?: Record<string, unknown>) => withScope(scope, 'list', params),
    custom: (...parts: KeyPart[]) => withScope(scope, ...parts),
  } as const;
}
