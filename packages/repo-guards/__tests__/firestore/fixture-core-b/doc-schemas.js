import { z } from 'zod';

const shelfItemBase = {
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  photoAssetId: z.string(),
  hidden: z.boolean(),
};

export const PublishedBookSchema = z.object({ ...shelfItemBase, content: z.string() });
export const PublishedAlbumSchema = z.object({ ...shelfItemBase, audioAssetId: z.string() });
export const PublishedFilmSchema = z.object({ ...shelfItemBase, videoAssetId: z.string() });

const sectionSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number(),
});
const subItemSchema = z.object({ title: z.string(), order: z.number(), hidden: z.boolean() });

export const COLLECTION_SCHEMAS = Object.freeze({
  'accessRequests/{requestId}': z.object({ status: z.string(), createdAt: z.number() }),
  'accessRequests/{requestId}/privateDetails/requester': z.object({
    schemaVersion: z.literal(1),
    requesterName: z.string(),
    authorizedRepresentative: z
      .object({ name: z.string(), authorityCertification: z.literal(true) })
      .optional(),
  }),
  'shelves/{shelfId}': z.object({ title: z.string(), ownerId: z.string() }),
  'shelves/{shelfId}/shelfBooks/{itemId}': PublishedBookSchema,
  'shelves/{shelfId}/shelfAlbums/{itemId}': PublishedAlbumSchema,
  'shelves/{shelfId}/shelfFilms/{itemId}': PublishedFilmSchema,
  'projects/{projectId}': z.object({ workingTitle: z.string(), kind: z.string() }),
  'projects/{projectId}/projectBooks/{sectionId}': sectionSchema,
  'projects/{projectId}/projectBooks/{sectionId}/bookChapters/{subItemId}': subItemSchema,
  'projects/{projectId}/projectAlbums/{sectionId}': sectionSchema,
  'projects/{projectId}/projectAlbums/{sectionId}/albumTracks/{subItemId}': subItemSchema,
  'projects/{projectId}/projectFilms/{sectionId}': sectionSchema,
  'projects/{projectId}/projectFilms/{sectionId}/filmEpisodes/{subItemId}': subItemSchema,
});
