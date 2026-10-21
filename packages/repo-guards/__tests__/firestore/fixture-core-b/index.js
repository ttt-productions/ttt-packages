// The second fixture core: a neutral library reproducing only what the write guard observes — its
// path-constant maps, path builders, and owner maps. Its shelves route one family of items through
// per-kind subcollections: a builder taking the subcollection as an argument, a builder mapping a
// kind to its subcollection, a map of path builders per kind, a field map whose values are lists of
// keys, and one canonical schema per kind. Test data for this package's own tests; nothing here is a
// definition any app imports.

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

const sectionPaths = (section, subItems) =>
  Object.freeze({
    section: (a0) => ['projects', a0, section],
    sectionDoc: (a0, a1) => ['projects', a0, section, a1],
    subItems: (a0, a1) => ['projects', a0, section, a1, subItems],
    subItem: (a0, a1, a2) => ['projects', a0, section, a1, subItems, a2],
  });

export const PROJECT_SECTION_PATHS_BY_KIND = Object.freeze({
  Books: sectionPaths('projectBooks', 'bookChapters'),
  Albums: sectionPaths('projectAlbums', 'albumTracks'),
  Films: sectionPaths('projectFilms', 'filmEpisodes'),
});

export const PATH_BUILDERS = Object.freeze({
  accessRequest: (a0) => ['accessRequests', a0],
  accessRequesterPrivate: (a0) => ['accessRequests', a0, 'privateDetails', 'requester'],
  shelf: (a0) => ['shelves', a0],
  shelfItemType: (a0, a1, a2) => ['shelves', a0, a1, a2],
  shelfSubItem: (a0, a1, a2) => ['shelves', a0, SHELF_SUBCOLLECTION_BY_KIND[a1], a2],
  project: (a0) => ['projects', a0],
});

export const toPath = (segments) => segments.join('/');

export const PUBLISHED_SHELF_ITEM_BY_KIND = Object.freeze({
  Books: Object.freeze({ subcollection: 'shelfBooks', schema: PublishedBookSchema }),
  Albums: Object.freeze({ subcollection: 'shelfAlbums', schema: PublishedAlbumSchema }),
  Films: Object.freeze({ subcollection: 'shelfFilms', schema: PublishedFilmSchema }),
});
