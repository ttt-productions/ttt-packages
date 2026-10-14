// Render-time picture URLs, pure and configuration-injected: q-core reads no environment, and the
// app resolves its Storage origin and bucket once and builds one builder. A document stores picture
// ids and never a URL; every render builds the URL from the id and the size it needs
// (MEDIA-101, BACKEND-001).

import { buildPictureObjectPath } from '../paths/storage-paths.js';
import type { PictureVariantKey } from '../types/unions.js';

export interface PictureUrlBuilderConfig {
  /** The origin serving the bucket's objects: Firebase Storage, or the local Storage emulator. */
  storageOrigin: string;
  bucket: string;
}

export type PictureUrlBuilder = (pictureId: string, variantKey: PictureVariantKey) => string;

/**
 * The URL is the object's media endpoint with no download token, so it resolves only through a
 * public-read `storage.rules` grant on the picture prefix — which is what lets every viewer, signed
 * in or not, load it.
 */
export function createPictureUrlBuilder(config: PictureUrlBuilderConfig): PictureUrlBuilder {
  const origin = config.storageOrigin.replace(/\/+$/, '');
  const { bucket } = config;
  if (!origin || !bucket) {
    throw new Error('createPictureUrlBuilder: storageOrigin and bucket are required');
  }
  return (pictureId, variantKey) => {
    const objectPath = encodeURIComponent(buildPictureObjectPath(pictureId, variantKey));
    return `${origin}/v0/b/${bucket}/o/${objectPath}?alt=media`;
  };
}
