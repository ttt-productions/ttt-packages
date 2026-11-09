import { describe, expect, it } from 'vitest';
import * as root from '../src/index.js';

describe('the auth-core root', () => {
  it('holds no product value: no default password policy or registration engine settings', () => {
    expect(Object.keys(root).filter((name) => /^DEFAULT_/.test(name))).toEqual([]);
  });
});
