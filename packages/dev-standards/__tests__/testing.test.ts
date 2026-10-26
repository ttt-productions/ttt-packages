import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { passThroughModule, stubModule } from '../src/testing.js';

const shapes = await import('./fixtures/shapes.js');
type Shapes = typeof shapes;

const importShapes = (): Promise<Shapes> => Promise.resolve(shapes);

describe('passThroughModule', () => {
  it('keeps every real export and replaces only the overrides', async () => {
    const area = (side: number) => side * 10;
    const mod = await passThroughModule(importShapes, { area });
    expect(mod.area).toBe(area);
    expect(mod.perimeter(2)).toBe(8);
    expect(mod.UNIT).toBe('cm');
  });

  it('keeps an override written as a getter a getter, so a case can change what it answers', async () => {
    let unit = 'mm';
    const mod = await passThroughModule(importShapes, {
      get UNIT() {
        return unit;
      },
    });
    unit = 'in';
    expect(mod.UNIT).toBe('in');
  });

  it("takes the module's type from importOriginal: overrides are its own exports, typed as the module types them", () => {
    expectTypeOf(passThroughModule(importShapes, {})).resolves.toEqualTypeOf<Shapes>();
    expectTypeOf(passThroughModule<Shapes>)
      .parameter(1)
      .toEqualTypeOf<Partial<Shapes>>();
  });
});

describe('stubModule', () => {
  it('answers only the stubs and never loads the real module', () => {
    const importOriginal = vi.fn(importShapes);
    const stubs = { UNIT: 'px' };
    expect(stubModule(importOriginal, stubs)).toBe(stubs);
    expect(importOriginal).not.toHaveBeenCalled();
  });

  it("takes the module's type from importOriginal", () => {
    expectTypeOf(stubModule(importShapes, {})).toEqualTypeOf<Partial<Shapes>>();
    expectTypeOf(stubModule<Shapes>)
      .parameter(1)
      .toEqualTypeOf<Partial<Shapes>>();
  });
});
