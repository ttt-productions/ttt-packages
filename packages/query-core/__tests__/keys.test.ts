import { describe, it, expect } from 'vitest';
import { keys, createKeyScope } from '../src/keys';

describe('keys.user', () => {
  it('all returns ["user"]', () => {
    expect(keys.user.all).toEqual(['user']);
  });

  it('detail returns ["user", "detail", id]', () => {
    expect(keys.user.detail('abc')).toEqual(['user', 'detail', 'abc']);
  });

  it('list without params returns ["user", "list"]', () => {
    const result = keys.user.list();
    expect(result[0]).toBe('user');
    expect(result[1]).toBe('list');
    expect(result.length).toBe(2);
  });

  it('list with a string param includes it', () => {
    const result = keys.user.list('userId-123');
    expect(result).toEqual(['user', 'list', 'userId-123']);
  });

  it('custom with multiple parts', () => {
    const result = keys.user.custom('foo', 'bar');
    expect(result[0]).toBe('user');
    expect(result[1]).toBe('foo');
    expect(result[2]).toBe('bar');
  });

  it('keys are arrays of Firestore-safe primitives only', () => {
    const k = keys.opportunities.custom('list', 'All', 'newest');
    // Compile-time: must be assignable to readonly (string|number|boolean|null)[]
    const _check: ReadonlyArray<string | number | boolean | null> = k;
    expect(_check).toEqual(['opportunities', 'list', 'All', 'newest']);
  });

  it('list filters out undefined params', () => {
    expect(keys.user.list(undefined)).toEqual(['user', 'list']);
    expect(keys.user.list()).toEqual(['user', 'list']);
  });
});

describe('keys scopes', () => {
  const scopes = [
    'follows', 'skills', 'entities', 'messages', 'library',
    'admin', 'opportunities', 'jobs', 'donations', 'futurePlans',
    'rulesAndAgreements', 'chat', 'notifications', 'shortLinks',
    'mentions', 'violations', 'feedback',
  ] as const;

  for (const scope of scopes) {
    it(`keys.${scope}.all starts with ["${scope}"]`, () => {
      expect((keys as any)[scope].all[0]).toBe(scope);
    });

    it(`keys.${scope}.detail("id") includes scope and id`, () => {
      const result = (keys as any)[scope].detail('test-id');
      expect(result[0]).toBe(scope);
      expect(result).toContain('test-id');
    });
  }
});

describe('keys.custom', () => {
  it('builds a custom key with "custom" scope', () => {
    const result = keys.custom('myKey', 'value');
    expect(result[0]).toBe('custom');
    expect(result[1]).toBe('myKey');
    expect(result[2]).toBe('value');
  });
});

describe('createKeyScope', () => {
  it('creates all key with the given scope', () => {
    const myScope = createKeyScope('myScope');
    expect(myScope.all).toEqual(['myScope']);
  });

  it('creates detail key', () => {
    const myScope = createKeyScope('myScope');
    expect(myScope.detail('123')).toEqual(['myScope', 'detail', '123']);
  });

  it('creates list key with a string param', () => {
    const myScope = createKeyScope('myScope');
    const result = myScope.list('active');
    expect(result[0]).toBe('myScope');
    expect(result[1]).toBe('list');
    expect(result[2]).toBe('active');
  });

  it('creates custom key', () => {
    const myScope = createKeyScope('myScope');
    const result = myScope.custom('a', 'b', 'c');
    expect(result[0]).toBe('myScope');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('works with different scope names', () => {
    const scope1 = createKeyScope('alpha');
    const scope2 = createKeyScope('beta');
    expect(scope1.all[0]).toBe('alpha');
    expect(scope2.all[0]).toBe('beta');
  });
});
