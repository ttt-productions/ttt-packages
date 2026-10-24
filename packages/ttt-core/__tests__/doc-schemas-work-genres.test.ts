import { describe, it, expect, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import { WORK_PROJECT_SPECIFIC_GENRES } from '../src/constants/options.js';
import {
  FullTaleSchema,
  FullTelevisionSchema,
  FullTuneSchema,
} from '../src/doc-schemas/content.js';
import {
  UpdateTaleWorkGenresInputSchema,
  UpdateTelevisionWorkGenresInputSchema,
  UpdateTuneWorkGenresInputSchema,
} from '../src/schemas/hall-library.js';

const base = { uid: 'w1', createdOn: 1 };

describe('a stored work section holds only its medium’s genres, the same set its genre edit accepts', () => {
  it('a Tales section stores a Tales genre and refuses another medium’s', () => {
    expect(FullTaleSchema.safeParse({ ...base, workGenres: ['Fantasy'] }).success).toBe(true);
    expect(FullTaleSchema.safeParse({ ...base, workGenres: ['Jazz'] }).success).toBe(false);
    expectTypeOf<NonNullable<z.infer<typeof FullTaleSchema>['workGenres']>[number]>().toEqualTypeOf<
      z.infer<typeof UpdateTaleWorkGenresInputSchema>['workGenre']
    >();
  });

  it('a Tunes section stores a Tunes genre and refuses another medium’s', () => {
    expect(FullTuneSchema.safeParse({ ...base, workGenres: ['Jazz'] }).success).toBe(true);
    expect(FullTuneSchema.safeParse({ ...base, workGenres: ['Fantasy'] }).success).toBe(false);
    expectTypeOf<z.infer<typeof FullTuneSchema>['workGenres'][number]>().toEqualTypeOf<
      z.infer<typeof UpdateTuneWorkGenresInputSchema>['workGenre']
    >();
  });

  it('a Television section stores a Television genre and refuses another medium’s', () => {
    expect(FullTelevisionSchema.safeParse({ ...base, workGenres: ['Documentary'] }).success).toBe(
      true,
    );
    expect(FullTelevisionSchema.safeParse({ ...base, workGenres: ['Jazz'] }).success).toBe(false);
    expectTypeOf<z.infer<typeof FullTelevisionSchema>['workGenres'][number]>().toEqualTypeOf<
      z.infer<typeof UpdateTelevisionWorkGenresInputSchema>['workGenre']
    >();
  });

  it('every listed genre of a medium is storable on that medium’s section', () => {
    expect(
      FullTuneSchema.safeParse({ ...base, workGenres: [...WORK_PROJECT_SPECIFIC_GENRES.Tunes] })
        .success,
    ).toBe(true);
  });
});
