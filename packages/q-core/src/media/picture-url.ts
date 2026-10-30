import { buildPictureObjectPath } from '../paths/storage-paths.js';
import type { PictureVariantKey } from '../types/unions.js';

export interface PictureUrlBuilderConfig {
  storageOrigin: string;
  bucket: string;
}

export type PictureUrlBuilder = (pictureId: string, variantKey: PictureVariantKey) => string;

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
