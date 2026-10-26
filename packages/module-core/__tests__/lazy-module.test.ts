// Exception to RULE-STD-QUALITY-009: the in-case fixture imports are what the last two tests prove.

import { describe, it, expect, vi } from 'vitest';
import { lazyModule } from '../src/lazy-module.js';

vi.mock('./fixtures/loaded-module.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('./fixtures/loaded-module.js')>({ realModule: false });
});

describe('lazyModule', () => {
  it('imports once, on first use, and every later or concurrent caller shares that import', async () => {
    const load = vi.fn(async () => ({ value: 42 }));
    const loader = lazyModule(load);
    expect(load).not.toHaveBeenCalled();

    const results = await Promise.all([loader(), loader(), loader()]);
    await loader();

    expect(load).toHaveBeenCalledTimes(1);
    expect(new Set(results).size).toBe(1);
  });

  it('a failed import rejects every caller waiting on it, and the next call imports again', async () => {
    const failure = new Error('chunk failed to load');
    const load = vi
      .fn<() => Promise<{ value: number }>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ value: 7 });
    const loader = lazyModule(load);

    await expect(Promise.all([loader(), loader()])).rejects.toBe(failure);
    await expect(loader()).resolves.toEqual({ value: 7 });
    await loader();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('every concurrent caller of a loader gets the MOCK of a mocked module', async () => {
    const loadFixture = lazyModule(() => import('./fixtures/loaded-module.js'));
    const modules = await Promise.all([loadFixture(), loadFixture(), loadFixture()]);
    for (const module of modules) expect(module.realModule).toBe(false);
  });

  it('premise: two overlapping bare imports of a mocked module hand the second the REAL module', async () => {
    const [first, second] = await Promise.all([
      import('./fixtures/loaded-module.js'),
      import('./fixtures/loaded-module.js'),
    ]);
    expect(first.realModule).toBe(false);
    expect(second.realModule).toBe(true);
  });
});
