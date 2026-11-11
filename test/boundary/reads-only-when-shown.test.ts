import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: {
    app: {
      path: 'packages',
      anchor: 'packages/query-core/src/react/firestore/use-firestore-paginated.ts',
    },
  },
};

registerSuiteOf(
  {
    layout,
    generic: {
      readsOnlyWhenShown: {
        readsAhead: [
          {
            path: 'packages/query-core/src/react/firestore/use-firestore-paginated.ts',
            call: 'ensureQueryData<PaginatedPage<WithId<T>>>({ queryKey: paginatedPageKey(stableQueryKey, n - 1), queryFn: () => fetchPage(n - 1) })',
            why: "the paginated hook reads the previous page's saved copy for its cursor when the person asks for a page, so it is the read they asked for, not a read ahead",
          },
        ],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'readsOnlyWhenShown'),
);
