import { describe, it, expect } from 'vitest';
import { WORK_SECTION_PATHS_BY_TYPE } from '../src/paths/work-section-paths';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content';

describe('WORK_SECTION_PATHS_BY_TYPE', () => {
  it('covers every WorkProjectType — a dispatch with a hole would silently write nowhere', () => {
    expect(Object.keys(WORK_SECTION_PATHS_BY_TYPE).sort()).toEqual([...WORK_PROJECT_TYPE_KEYS].sort());
  });

  describe('Tales', () => {
    const paths = WORK_SECTION_PATHS_BY_TYPE.Tales;

    it('dispatches to the canonical Tale builders', () => {
      expect(paths.section('wp1')).toEqual(COLLECTION_REFS.workProjectTales('wp1'));
      expect(paths.sectionDoc('wp1', 't1')).toEqual(PATH_BUILDERS.workProjectTale('wp1', 't1'));
      expect(paths.subItems('wp1', 't1')).toEqual(PATH_BUILDERS.taleChapters('wp1', 't1'));
      expect(paths.subItem('wp1', 't1', 'c1')).toEqual(PATH_BUILDERS.taleChapter('wp1', 't1', 'c1'));
    });
  });

  describe('Tunes', () => {
    const paths = WORK_SECTION_PATHS_BY_TYPE.Tunes;

    it('dispatches to the canonical Tune builders', () => {
      expect(paths.section('wp1')).toEqual(COLLECTION_REFS.workProjectTunes('wp1'));
      expect(paths.sectionDoc('wp1', 't1')).toEqual(PATH_BUILDERS.workProjectTune('wp1', 't1'));
      expect(paths.subItems('wp1', 't1')).toEqual(COLLECTION_REFS.tuneTracks('wp1', 't1'));
      expect(paths.subItem('wp1', 't1', 'k1')).toEqual(PATH_BUILDERS.tuneTrack('wp1', 't1', 'k1'));
    });
  });

  describe('Television', () => {
    const paths = WORK_SECTION_PATHS_BY_TYPE.Television;

    it('dispatches to the canonical Television builders', () => {
      expect(paths.section('wp1')).toEqual(COLLECTION_REFS.workProjectTelevision('wp1'));
      expect(paths.sectionDoc('wp1', 'tv1')).toEqual(PATH_BUILDERS.workProjectTelevision('wp1', 'tv1'));
      expect(paths.subItems('wp1', 'tv1')).toEqual(PATH_BUILDERS.televisionEpisodes('wp1', 'tv1'));
      expect(paths.subItem('wp1', 'tv1', 'e1')).toEqual(
        PATH_BUILDERS.televisionEpisode('wp1', 'tv1', 'e1'),
      );
    });
  });

  it('keeps every tuple length consistent across the three types', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      const paths = WORK_SECTION_PATHS_BY_TYPE[type];
      expect(paths.section('wp1')).toHaveLength(3);
      expect(paths.sectionDoc('wp1', 's1')).toHaveLength(4);
      expect(paths.subItems('wp1', 's1')).toHaveLength(5);
      expect(paths.subItem('wp1', 's1', 'i1')).toHaveLength(6);
      // The sub-item doc is exactly its collection plus the sub-item id.
      expect(paths.subItem('wp1', 's1', 'i1')).toEqual([...paths.subItems('wp1', 's1'), 'i1']);
      // The section doc is exactly its collection plus the section id.
      expect(paths.sectionDoc('wp1', 's1')).toEqual([...paths.section('wp1'), 's1']);
    }
  });
});
