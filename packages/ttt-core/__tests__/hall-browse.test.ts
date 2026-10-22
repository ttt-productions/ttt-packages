import { describe, it, expect } from 'vitest';
import {
  HALL_BROWSE_DEFAULTS,
  HALL_LIBRARY_QUERY_KEYS,
  parseHallBrowseState,
  type HallBrowseState,
} from '../src/paths/hall-browse.js';
import { APP_ROUTES } from '../src/paths/app-routes.js';
import {
  HALL_LIBRARY_SORT_OPTIONS,
  HALL_WING_TYPES,
  WORK_PROJECT_TYPES,
} from '../src/constants/options.js';

function parseQuery(query: string): HallBrowseState {
  return parseHallBrowseState(new URLSearchParams(query));
}

function queryOf(href: string): string {
  return href.split('?')[1] ?? '';
}

describe('parseHallBrowseState', () => {
  it('accepts every canonical medium, wing, and sort key', () => {
    for (const workProjectType of Object.keys(WORK_PROJECT_TYPES)) {
      expect(parseQuery(`workProjectType=${workProjectType}`).filters.workProjectType).toBe(
        workProjectType,
      );
    }
    for (const hallWingType of Object.keys(HALL_WING_TYPES)) {
      expect(parseQuery(`hallWingType=${hallWingType}`).filters.hallWingType).toBe(hallWingType);
    }
    for (const sortBy of Object.keys(HALL_LIBRARY_SORT_OPTIONS)) {
      expect(parseQuery(`sortBy=${sortBy}`).filters.sortBy).toBe(sortBy);
    }
  });

  it('falls back to the default for a value that is not in its canonical map', () => {
    expect(
      parseQuery('workProjectType=Podcasts&hallWingType=sports&sortBy=trending&view=carousel'),
    ).toEqual(HALL_BROWSE_DEFAULTS);
  });

  it('falls back per field, keeping the good values', () => {
    const state = parseQuery('workProjectType=Television&hallWingType=nope&sortBy=oldest');
    expect(state.filters.workProjectType).toBe('Television');
    expect(state.filters.hallWingType).toBe(HALL_BROWSE_DEFAULTS.filters.hallWingType);
    expect(state.filters.sortBy).toBe('oldest');
  });

  it('never lets an inherited Object property pass as a filter value', () => {
    const state = parseQuery('workProjectType=constructor&sortBy=toString');
    expect(state.filters.workProjectType).toBe(HALL_BROWSE_DEFAULTS.filters.workProjectType);
    expect(state.filters.sortBy).toBe(HALL_BROWSE_DEFAULTS.filters.sortBy);
  });

  it('reads the defaults from a bare browse URL, and the grid or list view mode', () => {
    expect(parseQuery('')).toEqual(HALL_BROWSE_DEFAULTS);
    expect(parseQuery('view=list').viewMode).toBe('list');
    expect(parseQuery('view=grid').viewMode).toBe('grid');
  });

  it('reads the keys the route builders write', () => {
    expect(HALL_LIBRARY_QUERY_KEYS).toEqual({
      workProjectType: 'workProjectType',
      hallWingType: 'hallWingType',
      sortBy: 'sortBy',
      view: 'view',
      item: 'item',
    });
  });
});

describe('Hall browse URLs round-trip', () => {
  it('every canonical state survives parse, then build, then parse', () => {
    for (const workProjectType of [...Object.keys(WORK_PROJECT_TYPES), 'All']) {
      for (const hallWingType of [...Object.keys(HALL_WING_TYPES), 'All']) {
        for (const sortBy of Object.keys(HALL_LIBRARY_SORT_OPTIONS)) {
          for (const view of ['grid', 'list']) {
            const state = parseQuery(
              `workProjectType=${workProjectType}&hallWingType=${hallWingType}&sortBy=${sortBy}&view=${view}`,
            );
            expect(parseQuery(queryOf(APP_ROUTES.hallLibrary(state)))).toEqual(state);
            expect(parseQuery(queryOf(APP_ROUTES.hallItem('h1', { browse: state })))).toEqual(
              state,
            );
          }
        }
      }
    }
  });

  it('writes the keys in one fixed order whatever order they were read in', () => {
    expect(
      APP_ROUTES.hallLibrary(
        parseQuery('view=list&sortBy=oldest&hallWingType=educational&workProjectType=Tunes'),
      ),
    ).toBe('/hall-library?workProjectType=Tunes&hallWingType=educational&sortBy=oldest&view=list');
  });

  it('an explicit default and an omitted default give the same URL', () => {
    expect(
      APP_ROUTES.hallLibrary(
        parseQuery('workProjectType=Tales&hallWingType=entertainment&sortBy=newest&view=grid'),
      ),
    ).toBe('/hall-library');
  });

  it('a browse URL drops unknown keys and the item key', () => {
    expect(
      APP_ROUTES.hallLibrary(parseQuery('workProjectType=Tunes&utm_source=share&item=chapter-3')),
    ).toBe('/hall-library?workProjectType=Tunes');
  });

  it('the item a Hall item URL opens on is read back from its own key', () => {
    const href = APP_ROUTES.hallItem('h1', {
      browse: parseQuery('workProjectType=Tunes'),
      item: 'chapter-3',
    });
    expect(new URLSearchParams(queryOf(href)).get(HALL_LIBRARY_QUERY_KEYS.item)).toBe('chapter-3');
  });
});

describe('HALL_BROWSE_DEFAULTS', () => {
  it('cannot be changed by a consumer, at either level', () => {
    expect(Object.isFrozen(HALL_BROWSE_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(HALL_BROWSE_DEFAULTS.filters)).toBe(true);
    expect(() => {
      (HALL_BROWSE_DEFAULTS as { viewMode: string }).viewMode = 'list';
    }).toThrow(TypeError);
    expect(() => {
      (HALL_BROWSE_DEFAULTS.filters as { sortBy: string }).sortBy = 'oldest';
    }).toThrow(TypeError);
    expect(HALL_BROWSE_DEFAULTS.viewMode).toBe('grid');
    expect(HALL_BROWSE_DEFAULTS.filters.sortBy).toBe('newest');
  });
});
