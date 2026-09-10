// Type-dispatchable Work section paths — the ONE owner of "given a WorkProjectType, where do
// that Work's live section and sub-item documents live?" (ARCH-104).
//
// The per-type builders in `path-builders.ts` / `collection-refs.ts` are the canonical
// segment owners; this map only DISPATCHES to them, so a backend writer that must act on
// whichever section a Work happens to be (e.g. the Hall text-clear remedy, which clears the
// live chapters / tracks / episodes of an offending Work) never assembles a path by hand and
// never re-quotes a segment constant. Nothing here restates a segment — every entry composes
// an existing builder.
//
// It lives in its own module rather than inside `collection-refs.ts` or `path-builders.ts`
// because it needs BOTH of them, and putting it in either would create an import cycle.

import { COLLECTION_REFS } from './collection-refs.js';
import { PATH_BUILDERS } from './path-builders.js';
import type { WorkProjectType } from '../types/content.js';

export interface WorkSectionPaths {
  /** The Work's live section collection (allWorkProjects/{wp}/workProject{Tales|Tunes|Television}). */
  readonly section: (workProjectId: string) => readonly [string, string, string];
  /** One section doc (the Tale / Tune / Television detail). */
  readonly sectionDoc: (workProjectId: string, sectionId: string) => readonly [string, string, string, string];
  /** The section's sub-item collection (taleChapters / tuneTracks / televisionEpisodes). */
  readonly subItems: (workProjectId: string, sectionId: string) => readonly [string, string, string, string, string];
  /** One sub-item doc (chapter / track / episode). */
  readonly subItem: (workProjectId: string, sectionId: string, subItemId: string) => readonly [string, string, string, string, string, string];
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
