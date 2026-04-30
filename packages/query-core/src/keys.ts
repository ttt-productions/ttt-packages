/**
 * Lightweight, stable, Firestore-safe query key helpers.
 *
 * All keys are arrays of `string | number | boolean | null` so they can
 * be written into Firestore docs (used by the unified upload pipeline's
 * `result.invalidate` field) and read back by the frontend hook to call
 * `queryClient.invalidateQueries`. Both sides produce structurally
 * identical arrays.
 *
 * Convention:
 * - `keys.user.all` => ['user']
 * - `keys.user.detail(id)` => ['user', 'detail', id]
 * - `keys.user.list(param?)` => ['user', 'list', param?]
 * - `keys.user.custom('accountStatus', id)` => ['user', 'accountStatus', id]
 *
 * For list filters that need multiple discriminators, use `custom`:
 *   keys.opportunities.custom('list', filter, sortBy)
 */
type SerializedKeyPart = string | number | boolean | null | undefined;

export type QueryKey = ReadonlyArray<string | number | boolean | null>;

function withScope(scope: string, ...parts: SerializedKeyPart[]): QueryKey {
  const cleaned = parts.filter((p): p is Exclude<SerializedKeyPart, undefined> => p !== undefined);
  return [scope, ...cleaned] as const;
}

export const keys = {
  user: {
    all: withScope('user'),
    detail: (id: string) => withScope('user', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('user', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('user', ...parts),
  },
  follows: {
    all: withScope('follows'),
    detail: (id: string) => withScope('follows', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('follows', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('follows', ...parts),
  },
  skills: {
    all: withScope('skills'),
    detail: (id: string) => withScope('skills', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('skills', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('skills', ...parts),
  },
  projects: {
    all: withScope('projects'),
    detail: (id: string) => withScope('projects', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('projects', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('projects', ...parts),
  },
  messages: {
    all: withScope('messages'),
    detail: (id: string) => withScope('messages', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('messages', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('messages', ...parts),
  },
  library: {
    all: withScope('library'),
    detail: (id: string) => withScope('library', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('library', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('library', ...parts),
  },
  admin: {
    all: withScope('admin'),
    detail: (id: string) => withScope('admin', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('admin', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('admin', ...parts),
  },
  opportunities: {
    all: withScope('opportunities'),
    detail: (id: string) => withScope('opportunities', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('opportunities', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('opportunities', ...parts),
  },
  jobs: {
    all: withScope('jobs'),
    detail: (id: string) => withScope('jobs', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('jobs', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('jobs', ...parts),
  },
  donations: {
    all: withScope('donations'),
    detail: (id: string) => withScope('donations', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('donations', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('donations', ...parts),
  },
  futurePlans: {
    all: withScope('futurePlans'),
    detail: (id: string) => withScope('futurePlans', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('futurePlans', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('futurePlans', ...parts),
  },
  rulesAndAgreements: {
    all: withScope('rulesAndAgreements'),
    detail: (id: string) => withScope('rulesAndAgreements', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('rulesAndAgreements', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('rulesAndAgreements', ...parts),
  },
  chat: {
    all: withScope('chat'),
    detail: (id: string) => withScope('chat', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('chat', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('chat', ...parts),
  },
  notifications: {
    all: withScope('notifications'),
    detail: (id: string) => withScope('notifications', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('notifications', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('notifications', ...parts),
  },
  shortLinks: {
    all: withScope('shortLinks'),
    detail: (id: string) => withScope('shortLinks', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('shortLinks', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('shortLinks', ...parts),
  },
  mentions: {
    all: withScope('mentions'),
    detail: (id: string) => withScope('mentions', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('mentions', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('mentions', ...parts),
  },
  violations: {
    all: withScope('violations'),
    detail: (id: string) => withScope('violations', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('violations', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('violations', ...parts),
  },
  feedback: {
    all: withScope('feedback'),
    detail: (id: string) => withScope('feedback', 'detail', id),
    list: (param?: SerializedKeyPart) => withScope('feedback', 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope('feedback', ...parts),
  },
  custom: (...parts: SerializedKeyPart[]) => withScope('custom', ...parts),
} as const;

/**
 * Utility for apps that want to define their own scoped key sets
 * while following the same conventions.
 */
export function createKeyScope(scope: string) {
  return {
    all: withScope(scope),
    detail: (id: string) => withScope(scope, 'detail', id),
    list: (param?: SerializedKeyPart) => withScope(scope, 'list', param),
    custom: (...parts: SerializedKeyPart[]) => withScope(scope, ...parts),
  } as const;
}
