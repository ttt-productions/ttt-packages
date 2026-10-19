// The query-key guards: every key is a named builder in the one key module, the module holds one
// name per key, and a key for the signed-in account's own data carries its uid.

import { describe, expect, it } from 'vitest';
import {
  authScopedKeysGuard,
  queryKeysGuard,
} from '../../src/modules/frontend-reads/query-keys.js';
import { runOne } from './run.js';

const KEYS = 'src/lib/query-keys.ts';
const CLEAN_KEYS = [
  "import { keys } from 'pkg';",
  'export const thingKeys = {',
  '  all: keys.things.all,',
  '  detail: (id: string) => keys.things.detail(id),',
  "  list: (filter: string) => ['things', 'list', filter] as const,",
  "  mine: (uid: string) => ['things', 'mine', uid] as const,",
  '};',
  'export const personKeys = {',
  "  detail: (personId: string) => ['person', personId] as const,",
  '} as const;',
].join('\n');

describe('every query key is a named builder in the one query-key module', () => {
  const facts = { keyModule: KEYS };

  it('passes keys and cache calls taken from the module, a tuple type, and prose', async () => {
    const findings = await runOne(queryKeysGuard, facts, {
      [KEYS]: CLEAN_KEYS,
      'src/hooks/use-things.ts': [
        "import { thingKeys } from '@/lib/query-keys';",
        'useQuery({ queryKey: thingKeys.detail(id) });',
        'queryClient.setQueryData(thingKeys.detail(id), next);',
        'useBatch({ queryKeyPrefix: personKeys.detail(id)[0] });',
        'interface Options { queryKey: readonly [string, ...string[]] }',
        "// queryKey: ['things'] and queryKeyPrefix: 'person' named in prose only",
      ].join('\n'),
    });
    expect(findings).toEqual([]);
  });

  it('flags a hand-typed key, a builder result with a literal appended, a key past a newline, a positional key, and a literal prefix', async () => {
    const findings = await runOne(queryKeysGuard, facts, {
      [KEYS]: `${CLEAN_KEYS}\nconst p = { queryKeyPrefix: 'person' };`,
      'src/hooks/a.ts': "useQuery({ queryKey: ['things', id] });",
      'src/hooks/b.ts': "useQuery({ queryKey: [...thingKeys.detail(id), 'extra'] });",
      'src/hooks/c.ts': "useQuery({\n  queryKey:\n    ['things'],\n});",
      'src/hooks/d.ts': "getClient().setQueryData(\n  ['things', id],\n  next,\n);",
      'src/hooks/e.ts': 'useBatch({ queryKeyPrefix: `person` });',
      'src/hooks/f.ts': 'useQuery({ queryKey: [] });',
    });
    expect(findings).toEqual([
      { file: 'src/hooks/a.ts', line: 1, detail: 'a hand-typed queryKey array' },
      { file: 'src/hooks/b.ts', line: 1, detail: 'a hand-typed queryKey array' },
      { file: 'src/hooks/c.ts', line: 2, detail: 'a hand-typed queryKey array' },
      {
        file: 'src/hooks/d.ts',
        line: 1,
        detail: 'a hand-typed key array passed to a cache method',
      },
      { file: 'src/hooks/e.ts', line: 1, detail: 'a literal queryKeyPrefix' },
      { file: 'src/hooks/f.ts', line: 1, detail: 'a hand-typed queryKey array' },
      { file: KEYS, line: 11, detail: 'a literal queryKeyPrefix' },
    ]);
  });

  it("flags a second object under a key object's name", async () => {
    const findings = await runOne(queryKeysGuard, facts, {
      [KEYS]: CLEAN_KEYS,
      'src/lib/other.ts': "export const thingKeys = { all: ['things'] };",
      'src/hooks/use-things.ts': "import { thingKeys } from '@/lib/query-keys';",
    });
    expect(findings).toEqual([
      {
        file: 'src/lib/other.ts',
        line: 1,
        detail: 'a second thingKeys beside the one in src/lib/query-keys.ts',
      },
    ]);
  });

  it('flags a member that delegates to another and two members that build one key, whatever their parameter names', async () => {
    const findings = await runOne(queryKeysGuard, facts, {
      [KEYS]: [
        "import { keys } from 'pkg';",
        'export const thingKeys = {',
        '  detail: (id: string) => keys.things.detail(id),',
        '  byId: (thingId: string) => keys.things.detail(thingId),',
        '  person: (id: string) => personKeys.detail(id),',
        '};',
        'export const personKeys = {',
        "  detail: (personId: string) => ['person', personId] as const,",
        "  ignoring: (personId: string, extra: string) => ['person', personId] as const,",
        '};',
      ].join('\n'),
    });
    expect(findings).toEqual([
      {
        file: KEYS,
        line: 4,
        detail: 'thingKeys.byId builds the same key as thingKeys.detail: keys.things.detail($1)',
      },
      {
        file: KEYS,
        line: 5,
        detail: 'thingKeys.person delegates to personKeys.detail(…), a second name for its key',
      },
      {
        file: KEYS,
        line: 9,
        detail: "personKeys.ignoring builds the same key as personKeys.detail: ['person', $1]",
      },
    ]);
  });

  it('flags a module with no key builder, and a module that is gone', async () => {
    expect(await runOne(queryKeysGuard, facts, { [KEYS]: 'export const SCOPE = 1;' })).toEqual([
      {
        file: KEYS,
        detail:
          'no key builder found in the module (an exported object of name: (params) => key members), so the alias check checks nothing',
      },
    ]);
    expect(await runOne(queryKeysGuard, facts, {})).toEqual([
      { file: KEYS, detail: 'the query-key module no longer exists' },
    ]);
  });

  it('refuses facts with no key module', () => {
    expect(queryKeysGuard.factProblems({ keyModule: '' })).toEqual(['keyModule is missing']);
  });
});

describe("a key for the signed-in account's own data takes the uid", () => {
  const facts = {
    keyModule: KEYS,
    authScopedPrefixes: ['my', 'current', 'own'],
    uidParamNames: ['uid', 'userId'],
  };

  it('passes auth-scoped keys that take the uid first and key on it, and other keys', async () => {
    const findings = await runOne(authScopedKeysGuard, facts, {
      [KEYS]: [
        'export const aKeys = {',
        "  ownList: (uid: string) => scope.custom('ownList', uid),",
        "  myNamed: (userId: string) => scope.custom('x', userId), // myOther: () => []",
        "  detail: (id: string) => scope.custom('detail', id),",
        "  mystery: () => scope.custom('mystery'),",
        '};',
      ].join('\n'),
    });
    expect(findings).toEqual([]);
  });

  it('flags a key with no uid, one whose first parameter is something else, and one that drops the uid', async () => {
    const findings = await runOne(authScopedKeysGuard, facts, {
      [KEYS]: [
        'export const aKeys = {',
        "  myThings: () => scope.custom('myThings'),",
        "  currentDraft: (draftId: string, uid: string) => scope.custom('currentDraft', uid, draftId),",
        "  myIgnored: (uid: string) => scope.custom('myIgnored'),",
        '};',
      ].join('\n'),
    });
    expect(findings).toEqual([
      { file: KEYS, line: 2, detail: 'aKeys.myThings does not take the uid first' },
      { file: KEYS, line: 3, detail: 'aKeys.currentDraft does not take the uid first' },
      { file: KEYS, line: 4, detail: 'aKeys.myIgnored leaves the uid out of the key' },
    ]);
  });

  it('refuses facts with no auth-scoped prefix or uid name', () => {
    expect(
      authScopedKeysGuard.factProblems({
        keyModule: KEYS,
        authScopedPrefixes: [],
        uidParamNames: ['uid', 'uid'],
      }),
    ).toEqual(['authScopedPrefixes is empty', 'uidParamNames lists uid twice']);
  });
});
