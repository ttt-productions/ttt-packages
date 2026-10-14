import { describe, it, expect } from 'vitest';
import {
  PICTURE_ASPECT_KEYS,
  PICTURE_ASPECT_RATIOS,
  PICTURE_VARIANT_KEYS,
  buildPictureObjectPath,
  createPictureUrlBuilder,
  pictureAspectRatio,
} from '../src';

const PICTURE_ID = '3f2b6c1e-9a4d-4e8b-b7c2-5d1a0e9f8c34';
const BUCKET = 'q-sports-dev.firebasestorage.app';

describe('picture sizes', () => {
  it('are sm, md, and lg, smallest first', () => {
    expect([...PICTURE_VARIANT_KEYS]).toEqual(['sm', 'md', 'lg']);
  });
});

describe('picture aspects', () => {
  it('are the four crop shapes: square, landscape, classic, and banner', () => {
    expect([...PICTURE_ASPECT_KEYS]).toEqual(['square', 'landscape', 'classic', 'banner']);
    expect(Object.keys(PICTURE_ASPECT_RATIOS).sort()).toEqual([...PICTURE_ASPECT_KEYS].sort());
  });

  it('declare each shape as whole-number width to height', () => {
    expect(PICTURE_ASPECT_RATIOS).toEqual({
      square: { width: 1, height: 1 },
      landscape: { width: 16, height: 9 },
      classic: { width: 4, height: 3 },
      banner: { width: 3, height: 1 },
    });
    for (const aspect of PICTURE_ASPECT_KEYS) {
      const { width, height } = PICTURE_ASPECT_RATIOS[aspect];
      expect(Number.isInteger(width) && width > 0).toBe(true);
      expect(Number.isInteger(height) && height > 0).toBe(true);
    }
  });

  it('give each shape as one number, width over height, and no two shapes the same', () => {
    expect(pictureAspectRatio('landscape')).toBe(16 / 9);
    expect(pictureAspectRatio('banner')).toBe(3);
    const ratios = PICTURE_ASPECT_KEYS.map(pictureAspectRatio);
    expect(new Set(ratios).size).toBe(PICTURE_ASPECT_KEYS.length);
  });
});

describe('picture object path', () => {
  it('addresses a size of a picture under the one picture prefix, with no extension', () => {
    expect(buildPictureObjectPath(PICTURE_ID, 'md')).toBe(`pictures/${PICTURE_ID}/md`);
  });

  it('keeps every size of one picture under that picture id', () => {
    const paths = PICTURE_VARIANT_KEYS.map((key) => buildPictureObjectPath(PICTURE_ID, key));
    expect(new Set(paths).size).toBe(PICTURE_VARIANT_KEYS.length);
    for (const path of paths) expect(path.startsWith(`pictures/${PICTURE_ID}/`)).toBe(true);
  });
});

describe('picture URL builder', () => {
  const buildPictureUrl = createPictureUrlBuilder({
    storageOrigin: 'https://firebasestorage.googleapis.com',
    bucket: BUCKET,
  });

  it('builds the object media URL in the bucket, with the object path encoded as one segment', () => {
    expect(buildPictureUrl(PICTURE_ID, 'lg')).toBe(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/pictures%2F${PICTURE_ID}%2Flg?alt=media`,
    );
  });

  it('carries no download token, so no URL grants anything the rules do not', () => {
    for (const key of PICTURE_VARIANT_KEYS) expect(buildPictureUrl(PICTURE_ID, key)).not.toMatch(/token=/);
  });

  it('builds a distinct URL for each size', () => {
    const urls = PICTURE_VARIANT_KEYS.map((key) => buildPictureUrl(PICTURE_ID, key));
    expect(new Set(urls).size).toBe(PICTURE_VARIANT_KEYS.length);
  });

  it('serves from whatever origin it is given, with or without a trailing slash', () => {
    const emulator = createPictureUrlBuilder({ storageOrigin: 'http://localhost:9199/', bucket: BUCKET });
    expect(emulator(PICTURE_ID, 'sm')).toBe(
      `http://localhost:9199/v0/b/${BUCKET}/o/pictures%2F${PICTURE_ID}%2Fsm?alt=media`,
    );
  });

  it('refuses to build without an origin or a bucket', () => {
    expect(() => createPictureUrlBuilder({ storageOrigin: '', bucket: BUCKET })).toThrow();
    expect(() => createPictureUrlBuilder({ storageOrigin: 'https://firebasestorage.googleapis.com', bucket: '' })).toThrow();
  });
});
