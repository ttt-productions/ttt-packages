// lazyModule: one import per loader, shared by every concurrent caller, and retried after a failure.
// The last two tests pin the vitest behaviour the loader exists for: overlapping bare imports of a
// mocked module hand the second caller the REAL module, while a loader's callers all get the mock.
// Both run the fixture's import inside the case because that in-case import is what they prove, so
// this file is a reviewed exception to the load-at-the-top rule (QUALITY-008).

import { describe, it, expect, vi } from 'vitest';
import { lazyModule } from '../src/lazy-module.js';

vi.mock('./fixtures/loaded-module.js', () => ({ mockedModule: true }));

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
    for (const module of modules) expect(module).toHaveProperty('mockedModule', true);
  });

  it('premise: two overlapping bare imports of a mocked module hand the second the REAL module', async () => {
    // If this starts failing, vitest serves the mock to overlapping imports now: the loader stays
    // harmless, but the reason it exists is gone and its comment should say so.
    const [first, second] = await Promise.all([
      import('./fixtures/loaded-module.js'),
      import('./fixtures/loaded-module.js'),
    ]);
    expect(first).toHaveProperty('mockedModule', true);
    expect(second).toHaveProperty('realModule', true);
  });
});
