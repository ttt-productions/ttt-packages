import { describe, it, expect } from 'vitest';
import { FullTaleSchema, FullTuneSchema, FullTelevisionSchema } from '../src/doc-schemas/content';
import * as hallLibrarySchemas from '../src/schemas/hall-library';
import { WORK_PROJECT_ACTIONS } from '../src/permissions/work-project-permissions-data';
import {
  HALL_DETAIL_TEXT_FIELD_TO_WORK_SHELL_FIELD,
  WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD,
} from '../src/constants/business-content';

// A Work has one title and one description, typed on the Work; the Tale / Tune / Television
// section carries no text of its own.
describe('the Tale, Tune, and Television section docs', () => {
  it.each([
    ['Tale', FullTaleSchema],
    ['Tune', FullTuneSchema],
    ['Television', FullTelevisionSchema],
  ] as const)('%s declares no title, description, or text-clear fields', (_name, schema) => {
    const keys = Object.keys(schema.shape);
    for (const field of ['title', 'description', 'moderationClearedFields', 'moderationClearedReason', 'moderatedAt']) {
      expect(keys).not.toContain(field);
    }
  });

  it('have no details-update input of their own', () => {
    const names = Object.keys(hallLibrarySchemas);
    for (const removed of ['UpdateTaleDetailsInputSchema', 'UpdateTuneDetailsInputSchema', 'UpdateTelevisionDetailsInputSchema']) {
      expect(names).not.toContain(removed);
    }
  });

  it('have no details-update action', () => {
    const actions = Object.keys(WORK_PROJECT_ACTIONS);
    for (const removed of ['hallLibrary.tale.details.update', 'hallLibrary.tune.details.update', 'hallLibrary.television.details.update']) {
      expect(actions).not.toContain(removed);
    }
  });
});

describe('the Hall detail text maps to the Work', () => {
  it("maps the Hall title and description to the Work's own fields", () => {
    expect(HALL_DETAIL_TEXT_FIELD_TO_WORK_SHELL_FIELD).toEqual({
      title: 'workingTitle',
      description: 'workingDescription',
    });
  });

  it('is the exact inverse of the Work-to-Hall map', () => {
    for (const [hallField, workField] of Object.entries(HALL_DETAIL_TEXT_FIELD_TO_WORK_SHELL_FIELD)) {
      expect(WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD[workField]).toBe(hallField);
    }
  });
});
