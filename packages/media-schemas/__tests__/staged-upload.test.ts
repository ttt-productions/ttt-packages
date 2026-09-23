import { describe, it, expect } from 'vitest';
import { NEUTRAL_CONTENT_TYPE } from '../src/helpers.js';
import { parseStorageObjectSize, verifyStagedUploadMetadata } from '../src/staged-upload.js';
import type { MediaOriginSpec } from '../src/types.js';

type Spec = Pick<MediaOriginSpec, 'accept' | 'maxBytes'>;

const IMAGE_ONLY: Spec = { accept: { kinds: ['image'] }, maxBytes: 25 * 1024 * 1024 };
const FILES: Spec = { accept: { kinds: ['file'], mimes: ['application/pdf', 'text/*'] }, maxBytes: 1024 };
const STRICT = { allowNeutralContentType: false };
const NEUTRAL_OK = { allowNeutralContentType: true };

describe('verifyStagedUploadMetadata', () => {
  it('accepts a content type of an accepted kind within the size cap', () => {
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg', size: '1024' }, IMAGE_ONLY, STRICT)).toEqual({
      ok: true,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    });
  });

  it('rejects a content type the origin does not accept (image origin + video)', () => {
    expect(verifyStagedUploadMetadata({ contentType: 'video/mp4', size: '1024' }, IMAGE_ONLY, STRICT)).toEqual({
      ok: false,
      reason: 'unsupported-content-type',
      contentType: 'video/mp4',
    });
  });

  it('rejects a size over maxBytes', () => {
    const size = String(30 * 1024 * 1024);
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg', size }, IMAGE_ONLY, STRICT)).toEqual({
      ok: false,
      reason: 'too-large',
      sizeBytes: 30 * 1024 * 1024,
      maxBytes: 25 * 1024 * 1024,
    });
  });

  it('accepts any size when the spec sets no cap', () => {
    const verdict = verifyStagedUploadMetadata({ contentType: 'image/png', size: 9e12 }, { accept: { kinds: ['image'] } }, STRICT);
    expect(verdict).toMatchObject({ ok: true, sizeBytes: 9e12 });
  });

  describe('the neutral content type', () => {
    it('passes the gate when the app opts in (byte inspection at processing decides)', () => {
      expect(verifyStagedUploadMetadata({ contentType: NEUTRAL_CONTENT_TYPE, size: '1024' }, IMAGE_ONLY, NEUTRAL_OK)).toEqual({
        ok: true,
        contentType: NEUTRAL_CONTENT_TYPE,
        sizeBytes: 1024,
      });
    });

    it('is rejected when the app has not opted in', () => {
      expect(verifyStagedUploadMetadata({ contentType: NEUTRAL_CONTENT_TYPE, size: '1' }, IMAGE_ONLY, STRICT)).toMatchObject({
        ok: false,
        reason: 'unsupported-content-type',
      });
    });

    it('still honors the size cap when opted in', () => {
      expect(verifyStagedUploadMetadata({ contentType: NEUTRAL_CONTENT_TYPE, size: '2048' }, FILES, NEUTRAL_OK)).toMatchObject({
        ok: false,
        reason: 'too-large',
      });
    });
  });

  describe('file-kind origins match the MIME list', () => {
    it('accepts an exact MIME entry', () => {
      expect(verifyStagedUploadMetadata({ contentType: 'application/pdf', size: '10' }, FILES, STRICT)).toMatchObject({ ok: true });
    });
    it('accepts a wildcard MIME entry', () => {
      expect(verifyStagedUploadMetadata({ contentType: 'text/plain', size: '10' }, FILES, STRICT)).toMatchObject({ ok: true });
    });
    it('rejects a MIME not on the list', () => {
      expect(verifyStagedUploadMetadata({ contentType: 'application/zip', size: '10' }, FILES, STRICT)).toMatchObject({
        ok: false,
        reason: 'unsupported-content-type',
      });
    });
  });

  it('rejects a missing content type', () => {
    expect(verifyStagedUploadMetadata({ size: '10' }, IMAGE_ONLY, STRICT)).toEqual({
      ok: false,
      reason: 'unsupported-content-type',
      contentType: '',
    });
  });

  it('fails closed on an absent size', () => {
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg' }, IMAGE_ONLY, STRICT)).toEqual({
      ok: false,
      reason: 'unreadable-size',
      size: undefined,
    });
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg', size: null }, IMAGE_ONLY, STRICT)).toMatchObject({
      ok: false,
      reason: 'unreadable-size',
    });
  });

  it('accepts an explicit zero-byte size', () => {
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg', size: '0' }, IMAGE_ONLY, STRICT)).toMatchObject({ ok: true, sizeBytes: 0 });
  });

  it.each([['abc'], ['12abc'], ['-5'], ['1.5']])('fails closed on an unreadable size (%s)', (size) => {
    expect(verifyStagedUploadMetadata({ contentType: 'image/jpeg', size }, IMAGE_ONLY, STRICT)).toEqual({
      ok: false,
      reason: 'unreadable-size',
      size,
    });
  });
});

describe('parseStorageObjectSize', () => {
  it.each<[string, unknown, number]>([
    ['a numeric string', '1024', 1024],
    ['a numeric string with surrounding whitespace', ' 1024\n', 1024],
    ['a whole number', 2048, 2048],
    ['zero', 0, 0],
    ['a zero string', '0', 0],
    ['the largest safe integer', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ['the largest safe integer as a string', String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    ['a whole bigint', 10n, 10],
  ])('reads %s', (_label, size, bytes) => {
    expect(parseStorageObjectSize(size)).toBe(bytes);
  });

  it.each<[string, unknown]>([
    ['missing (undefined)', undefined],
    ['missing (null)', null],
    ['an empty string', ''],
    ['NaN', Number.NaN],
    ['a NaN string', 'NaN'],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative number', -1],
    ['a negative string', '-5'],
    ['a fractional number', 1.5],
    ['a fractional string', '1.5'],
    ['a trailing-zero decimal string', '10.0'],
    ['one beyond the largest safe integer', Number.MAX_SAFE_INTEGER + 1],
    ['a string beyond the largest safe integer', '9007199254740993'],
    ['a huge digit string', '99999999999999999999'],
    ['exponent notation', '1e3'],
    ['a signed string', '+5'],
    ['a hex string', '0x10'],
    ['a digit string with a suffix', '12abc'],
    ['an object', { size: 5 }],
    ['a boolean', true],
  ])('is undefined for %s', (_label, size) => {
    expect(parseStorageObjectSize(size)).toBeUndefined();
  });
});
