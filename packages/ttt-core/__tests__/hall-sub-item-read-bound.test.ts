import { describe, it, expect } from 'vitest';
import {
  CHARTER_LIMITS,
  FULL_LIMITS,
  HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE,
  type TttLimits,
} from '../src/constants/app-mode';
import { HALL_ITEM_SUBCOLLECTIONS, HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE } from '../src/paths/collections';
import { WORK_PROJECT_TYPE_KEYS, type WorkProjectType } from '../src/types/content';

// Which count cap bounds each kind, stated independently of the source so a bound wired to the
// wrong cap fails here.
const CAP_BY_WORK_TYPE: Record<WorkProjectType, (limits: TttLimits) => number> = {
  Tales: (limits) => limits.workProject.maxChapters,
  Tunes: (limits) => limits.workProject.maxTuneTracks,
  Television: (limits) => limits.workProject.maxTelevisionEpisodes,
};

describe('HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE', () => {
  it('covers every Hall sub-item kind and nothing else', () => {
    expect(Object.keys(HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE).sort()).toEqual([...WORK_PROJECT_TYPE_KEYS].sort());
  });

  it('gives every published Hall sub-item subcollection a bound', () => {
    for (const subcollection of Object.values(HALL_ITEM_SUBCOLLECTIONS)) {
      const workType = WORK_PROJECT_TYPE_KEYS.find(
        (type) => HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE[type] === subcollection,
      );
      expect(workType, `${subcollection} has no work type`).toBeDefined();
      expect(Number.isInteger(HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE[workType as WorkProjectType])).toBe(true);
    }
  });

  for (const workType of WORK_PROJECT_TYPE_KEYS) {
    it(`${workType}: equals that kind's largest cap across charter and full`, () => {
      const cap = CAP_BY_WORK_TYPE[workType];
      expect(HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE[workType]).toBe(
        Math.max(cap(CHARTER_LIMITS), cap(FULL_LIMITS)),
      );
    });
  }
});
