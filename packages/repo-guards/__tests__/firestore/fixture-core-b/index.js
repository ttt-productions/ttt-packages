import { PublishedAlbumSchema, PublishedBookSchema, PublishedFilmSchema } from './doc-schemas.js';

export const COLLECTIONS = Object.freeze({
  ACCESS_REQUESTS: 'accessRequests',
  SHELVES: 'shelves',
  PROJECTS: 'projects',
});

export const NESTED_SUBCOLLECTIONS = Object.freeze({
  PRIVATE_DETAILS: 'privateDetails',
});

export const SHELF_SUBCOLLECTIONS = Object.freeze({
  BOOKS: 'shelfBooks',
  ALBUMS: 'shelfAlbums',
  FILMS: 'shelfFilms',
});

export const SPECIAL_DOCS = Object.freeze({
  REQUESTER: 'requester',
});

export const SHELF_SUBCOLLECTION_BY_KIND = Object.freeze({
  Books: 'shelfBooks',
  Albums: 'shelfAlbums',
  Films: 'shelfFilms',
});

export const CLEARABLE_TEXT_FIELDS = Object.freeze({
  project: Object.freeze(['workingTitle']),
  book: Object.freeze(['title', 'content']),
  album: Object.freeze(['title', 'description']),
  film: Object.freeze(['title', 'description']),
});

const sectionPaths = (/** @type {string} */ section, /** @type {string} */ subItems) =>
  Object.freeze({
    section: (/** @type {string} */ a0) => ['projects', a0, section],
    sectionDoc: (/** @type {string} */ a0, /** @type {string} */ a1) => [
      'projects',
      a0,
      section,
      a1,
    ],
    subItems: (/** @type {string} */ a0, /** @type {string} */ a1) => [
      'projects',
      a0,
      section,
      a1,
      subItems,
    ],
    subItem: (/** @type {string} */ a0, /** @type {string} */ a1, /** @type {string} */ a2) => [
      'projects',
      a0,
      section,
      a1,
      subItems,
      a2,
    ],
  });

export const PROJECT_SECTION_PATHS_BY_KIND = Object.freeze({
  Books: sectionPaths('projectBooks', 'bookChapters'),
  Albums: sectionPaths('projectAlbums', 'albumTracks'),
  Films: sectionPaths('projectFilms', 'filmEpisodes'),
});

export const PATH_BUILDERS = Object.freeze({
  accessRequest: (/** @type {string} */ a0) => ['accessRequests', a0],
  accessRequesterPrivate: (/** @type {string} */ a0) => [
    'accessRequests',
    a0,
    'privateDetails',
    'requester',
  ],
  shelf: (/** @type {string} */ a0) => ['shelves', a0],
  shelfItemType: (/** @type {string} */ a0, /** @type {string} */ a1, /** @type {string} */ a2) => [
    'shelves',
    a0,
    a1,
    a2,
  ],
  shelfSubItem: (
    /** @type {string} */ a0,
    /** @type {keyof typeof SHELF_SUBCOLLECTION_BY_KIND} */ a1,
    /** @type {string} */ a2,
  ) => ['shelves', a0, SHELF_SUBCOLLECTION_BY_KIND[a1], a2],
  project: (/** @type {string} */ a0) => ['projects', a0],
});

export const toPath = (/** @type {readonly string[]} */ segments) => segments.join('/');

export const PUBLISHED_SHELF_ITEM_BY_KIND = Object.freeze({
  Books: Object.freeze({ subcollection: 'shelfBooks', schema: PublishedBookSchema }),
  Albums: Object.freeze({ subcollection: 'shelfAlbums', schema: PublishedAlbumSchema }),
  Films: Object.freeze({ subcollection: 'shelfFilms', schema: PublishedFilmSchema }),
});
