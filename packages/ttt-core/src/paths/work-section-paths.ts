// Its own module: it needs both collection-refs.ts and path-builders.ts, so in either it would be
// an import cycle.

import { COLLECTION_REFS } from './collection-refs.js';
import { PATH_BUILDERS } from './path-builders.js';
import type { WorkProjectType } from '../types/content.js';

export interface WorkSectionPaths {
  readonly section: (workProjectId: string) => readonly [string, string, string];
  readonly sectionDoc: (
    workProjectId: string,
    sectionId: string,
  ) => readonly [string, string, string, string];
  readonly subItems: (
    workProjectId: string,
    sectionId: string,
  ) => readonly [string, string, string, string, string];
  readonly subItem: (
    workProjectId: string,
    sectionId: string,
    subItemId: string,
  ) => readonly [string, string, string, string, string, string];
}

export const WORK_SECTION_PATHS_BY_TYPE: Record<WorkProjectType, WorkSectionPaths> = {
  Tales: {
    section: COLLECTION_REFS.workProjectTales,
    sectionDoc: PATH_BUILDERS.workProjectTale,
    subItems: PATH_BUILDERS.taleChapters,
    subItem: PATH_BUILDERS.taleChapter,
  },
  Tunes: {
    section: COLLECTION_REFS.workProjectTunes,
    sectionDoc: PATH_BUILDERS.workProjectTune,
    subItems: COLLECTION_REFS.tuneTracks,
    subItem: PATH_BUILDERS.tuneTrack,
  },
  Television: {
    section: COLLECTION_REFS.workProjectTelevision,
    sectionDoc: PATH_BUILDERS.workProjectTelevision,
    subItems: PATH_BUILDERS.televisionEpisodes,
    subItem: PATH_BUILDERS.televisionEpisode,
  },
};
