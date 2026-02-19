import { describe, it, expect } from 'vitest';
import { keys, createKeyScope } from '../src/keys';

describe('keys.user', () => {
  it('all returns ["user"]', () => {
    expect(keys.user.all).toEqual(['user']);
  });

  it('detail returns ["user", "detail", id]', () => {
    expect(keys.user.detail('abc')).toEqual(['user', 'detail', 'abc']);
  });

  it('list without params returns ["user", "list", undefined] without undefined', () => {
    const result = keys.user.list();
    expect(result[0]).toBe('user');
    expect(result[1]).toBe('list');
  });

  it('list with params includes the filter object', () => {
    const filter = { status: 'active' };
    const result = keys.user.list(filter);
    expect(result).toContain('user');
    expect(result).toContain('list');
    expect(result).toContain(filter);
  });

  it('custom with multiple parts', () => {
    const result = keys.user.custom('foo', 'bar');
    expect(result[0]).toBe('user');
    expect(result[1]).toBe('foo');
    expect(result[2]).toBe('bar');
  });
});

describe('keys scopes', () => {
  const scopes = [
    'follows', 'skills', 'projects', 'messages', 'library',
    'admin', 'opportunities', 'jobs', 'donations', 'futurePlans',
    'rulesAndAgreements', 'chat', 'notifications', 'shortLinks',
    'mentions', 'violations', 'feedback', 'social',
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

describe('keys.social (custom scope)', () => {
  it('feed without filter includes "feed"', () => {
    const result = keys.social.feed();
    expect(result[0]).toBe('social');
    expect(result).toContain('feed');
  });

  it('feed with filter includes the filter', () => {
    const result = keys.social.feed('trending');
    expect(result).toContain('trending');
  });

  it('trending returns ["social", "trending"]', () => {
    expect(keys.social.trending()).toEqual(['social', 'trending']);
  });
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

  it('creates list key with params', () => {
    const myScope = createKeyScope('myScope');
    const filter = { page: 1 };
    const result = myScope.list(filter);
    expect(result[0]).toBe('myScope');
    expect(result[1]).toBe('list');
    expect(result).toContain(filter);
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
