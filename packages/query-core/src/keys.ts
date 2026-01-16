/**
 * Lightweight, stable query key helpers.
 *
 * Convention:
 * - `keys.user.all` => ['user']
 * - `keys.user.detail(id)` => ['user', 'detail', id]
 * - `keys.user.list(filters?)` => ['user', 'list', filters]
 * - `keys.user.custom('accountStatus', id)` => ['user', 'accountStatus', id]
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
    custom: (...parts: KeyPart[]) => withScope('user', ...parts),
  },
  follows: {
    all: withScope('follows'),
    detail: (id: string) => withScope('follows', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('follows', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('follows', ...parts),
  },
  skills: {
    all: withScope('skills'),
    detail: (id: string) => withScope('skills', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('skills', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('skills', ...parts),
  },
  projects: {
    all: withScope('projects'),
    detail: (id: string) => withScope('projects', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('projects', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('projects', ...parts),
  },
  messages: {
    all: withScope('messages'),
    detail: (id: string) => withScope('messages', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('messages', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('messages', ...parts),
  },
  library: {
    all: withScope('library'),
    detail: (id: string) => withScope('library', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('library', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('library', ...parts),
  },
  admin: {
    all: withScope('admin'),
    detail: (id: string) => withScope('admin', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('admin', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('admin', ...parts),
  },
  opportunities: {
    all: withScope('opportunities'),
    detail: (id: string) => withScope('opportunities', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('opportunities', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('opportunities', ...parts),
  },
  jobs: {
    all: withScope('jobs'),
    detail: (id: string) => withScope('jobs', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('jobs', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('jobs', ...parts),
  },
  donations: {
    all: withScope('donations'),
    detail: (id: string) => withScope('donations', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('donations', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('donations', ...parts),
  },
  futurePlans: {
    all: withScope('futurePlans'),
    detail: (id: string) => withScope('futurePlans', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('futurePlans', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('futurePlans', ...parts),
  },
  rulesAndAgreements: {
    all: withScope('rulesAndAgreements'),
    detail: (id: string) => withScope('rulesAndAgreements', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('rulesAndAgreements', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('rulesAndAgreements', ...parts),
  },
  chat: {
    all: withScope('chat'),
    detail: (id: string) => withScope('chat', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('chat', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('chat', ...parts),
  },
  notifications: {
    all: withScope('notifications'),
    detail: (id: string) => withScope('notifications', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('notifications', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('notifications', ...parts),
  },
  shortLinks: {
    all: withScope('shortLinks'),
    detail: (id: string) => withScope('shortLinks', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('shortLinks', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('shortLinks', ...parts),
  },
  mentions: {
    all: withScope('mentions'),
    detail: (id: string) => withScope('mentions', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('mentions', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('mentions', ...parts),
  },
  violations: {
    all: withScope('violations'),
    detail: (id: string) => withScope('violations', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('violations', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('violations', ...parts),
  },
  feedback: {
    all: withScope('feedback'),
    detail: (id: string) => withScope('feedback', 'detail', id),
    list: (params?: Record<string, unknown>) => withScope('feedback', 'list', params),
    custom: (...parts: KeyPart[]) => withScope('feedback', ...parts),
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