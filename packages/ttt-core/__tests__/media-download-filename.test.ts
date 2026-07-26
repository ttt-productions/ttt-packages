// Download-filename contract + normalizer tests.
//
// Covers the CONTRACT half of the download-verification list in ttt-prod
// docs/code_changes_needed/CODE_CHANGE_invite_finalization_conversation_files_and_downloads.md
// §3: the optional `downloadFilename` on the canonical variant contract (present
// AND absent), the pure normalizer's sanitization rules, and the two RFC 6266 /
// RFC 8187 string forms the media Worker assembles its header from.
//
// The header ASSEMBLY, the ranged/HEAD parity, and the Playwright
// `suggestedFilename` checks are worker/app-side and live with those changes.

import { describe, it, expect } from 'vitest';
import { hashPayload } from '@ttt-productions/edge-protocol-core';
import {
  MediaAssetSchema,
  MediaAssetVariantSchema,
  MediaServingAuthorityRecordSchema,
} from '../src/doc-schemas/media-assets';
import type { EdgeServingRecord } from '../src/media/edge-serving-contract';
import {
  buildContentDispositionFilenameForms,
  extensionForContentType,
  normalizeDownloadFilename,
} from '../src/media/download-filename';
import {
  DOWNLOAD_FILENAME_FALLBACK_STEM,
  MAX_DOWNLOAD_FILENAME_BYTES,
} from '../src/constants/media-download';

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

// ===========================================================================
// The canonical variant contract
// ===========================================================================

describe('MediaAssetVariantSchema.downloadFilename', () => {
  const base = { contentType: 'image/jpeg', sizeBytes: 1234 };

  it('parses with the field ABSENT (every non-download surface stays untouched)', () => {
    const parsed = MediaAssetVariantSchema.parse({ ...base });
    expect(parsed.downloadFilename).toBeUndefined();
  });

  it('parses with the field PRESENT', () => {
    const parsed = MediaAssetVariantSchema.parse({ ...base, downloadFilename: 'evidence.jpg' });
    expect(parsed.downloadFilename).toBe('evidence.jpg');
  });

  it('rejects an empty filename (absent means "no download name", never "")', () => {
    expect(() => MediaAssetVariantSchema.parse({ ...base, downloadFilename: '' })).toThrow();
  });

  it('stays strict — an unknown sibling key is still rejected', () => {
    expect(() => MediaAssetVariantSchema.parse({ ...base, downloadName: 'x.jpg' })).toThrow();
  });
});

const asset = (variants: Record<string, unknown>) => ({
  mediaAssetId: 'asset-1',
  mediaKind: 'image' as const,
  fileOrigin: 'conversation-file' as const,
  ownerType: 'conversationFile' as const,
  ownerId: 'file-1',
  createdByUid: 'uid-1',
  accessTier: 'scoped' as const,
  servingStatus: 'servable' as const,
  variants,
  moderationStatus: 'approved' as const,
  retentionPolicy: 'standard' as const,
  legalHold: false,
  realmFileCanonStatus: 'none' as const,
  createdAt: 1,
  updatedAt: 2,
});

describe('downloadFilename rides every ttt-core shape that carries variants', () => {
  it('MediaAssetSchema.variants carries it, and parses without it', () => {
    const withName = MediaAssetSchema.parse(
      asset({ main: { contentType: 'image/jpeg', sizeBytes: 10, downloadFilename: 'a.jpg' } }),
    );
    expect(withName.variants.main.downloadFilename).toBe('a.jpg');

    const without = MediaAssetSchema.parse(
      asset({ main: { contentType: 'image/jpeg', sizeBytes: 10 } }),
    );
    expect(without.variants.main.downloadFilename).toBeUndefined();
  });

  it('MediaServingAuthorityRecordSchema.variants carries it, and parses without it', () => {
    const record = {
      schemaVersion: 1,
      assetId: 'asset-1',
      authorityVersion: 3,
      operationId: 'op-1',
      payloadHash: 'deadbeef',
      servingStatus: 'servable' as const,
      accessTier: 'scoped' as const,
      ownerType: 'conversationFile' as const,
      ownerId: 'file-1',
      scope: { kind: 'guildInvite' as const, guildInviteId: 'invite-1' },
      variants: { main: { contentType: 'video/mp4', sizeBytes: 99, downloadFilename: 'clip.mp4' } },
      updatedAtMs: 5,
    };
    expect(MediaServingAuthorityRecordSchema.parse(record).variants.main.downloadFilename).toBe(
      'clip.mp4',
    );

    const legacy = {
      ...record,
      variants: { main: { contentType: 'video/mp4', sizeBytes: 99 } },
    };
    expect(
      MediaServingAuthorityRecordSchema.parse(legacy).variants.main.downloadFilename,
    ).toBeUndefined();
  });

  it('EdgeServingRecord variants accept it and remain valid without it (type-level)', () => {
    const withName: EdgeServingRecord = {
      servingStatus: 'servable',
      accessTier: 'scoped',
      ownerType: 'conversationFile',
      ownerId: 'file-1',
      scope: { kind: 'adminSupport', adminDispatchId: 'dispatch-1' },
      variants: { main: { contentType: 'image/webp', sizeBytes: 7, downloadFilename: 'x.webp' } },
    };
    const without: EdgeServingRecord = {
      servingStatus: 'servable',
      accessTier: 'broad',
      ownerType: 'hallItem',
      ownerId: 'hall-1',
      variants: { full: { contentType: 'image/webp', sizeBytes: 7 } },
    };
    expect(withName.variants.main.downloadFilename).toBe('x.webp');
    expect(without.variants.full.downloadFilename).toBeUndefined();
  });
});

describe('authority payload hashing is unchanged for records that do not set it', () => {
  const payload = (variant: Record<string, unknown>) => ({
    schemaVersion: 1,
    assetId: 'asset-1',
    authorityVersion: 1,
    servingStatus: 'servable',
    accessTier: 'broad',
    ownerType: 'hallItem',
    ownerId: 'hall-1',
    scope: null,
    variants: { full: variant },
  });

  it('an ABSENT downloadFilename hashes identically to an explicitly-undefined one', async () => {
    const absent = await hashPayload(payload({ contentType: 'image/jpeg', sizeBytes: 10 }));
    const undefinedValue = await hashPayload(
      payload({ contentType: 'image/jpeg', sizeBytes: 10, downloadFilename: undefined }),
    );
    expect(undefinedValue).toBe(absent);
  });

  it('a SET downloadFilename changes the hash (it is serving-semantic)', async () => {
    const absent = await hashPayload(payload({ contentType: 'image/jpeg', sizeBytes: 10 }));
    const set = await hashPayload(
      payload({ contentType: 'image/jpeg', sizeBytes: 10, downloadFilename: 'a.jpg' }),
    );
    expect(set).not.toBe(absent);
  });
});

// ===========================================================================
// The normalizer
// ===========================================================================

describe('normalizeDownloadFilename', () => {
  it('passes a plain ASCII name through', () => {
    expect(normalizeDownloadFilename('report.pdf', { contentType: 'application/pdf' })).toBe(
      'report.pdf',
    );
  });

  it('collapses whitespace and trims edge spaces', () => {
    expect(
      normalizeDownloadFilename('   My   Vacation  Photo .jpg  ', { contentType: 'image/jpeg' }),
    ).toBe('My Vacation Photo.jpg');
  });

  it('keeps Unicode letters intact', () => {
    expect(normalizeDownloadFilename('café résumé.png', { contentType: 'image/png' })).toBe(
      'café résumé.png',
    );
  });

  it('keeps emoji intact', () => {
    expect(normalizeDownloadFilename('🎬 final cut.mp4', { contentType: 'video/mp4' })).toBe(
      '🎬 final cut.mp4',
    );
  });

  it('removes every quote form', () => {
    expect(normalizeDownloadFilename('he said "hi".txt')).toBe('he said hi.txt');
    expect(normalizeDownloadFilename("DJ's photo.jpg", { contentType: 'image/jpeg' })).toBe(
      'DJs photo.jpg',
    );
    expect(normalizeDownloadFilename('\u201Csmart\u201D \u2018quotes\u2019.png')).toBe(
      'smart quotes.png',
    );
  });

  it('removes CR/LF and every other control character (no header injection)', () => {
    const out = normalizeDownloadFilename('evil\r\nContent-Length: 0\r\n\r\nname.jpg', {
      contentType: 'image/jpeg',
    });
    expect(out).not.toMatch(/[\r\n]/);
    const isControl = (cp: number) => cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
    expect([...out].some((ch) => isControl(ch.codePointAt(0) ?? 0))).toBe(false);
    expect(out.endsWith('.jpg')).toBe(true);
  });

  it('removes bidi override characters used to disguise an extension', () => {
    const out = normalizeDownloadFilename('invoice\u202Egnp.exe', { contentType: 'image/png' });
    expect(out).not.toMatch(/[\u202A-\u202E]/);
  });

  it('takes the basename only — POSIX and Windows paths alike', () => {
    expect(normalizeDownloadFilename('../../etc/passwd')).toBe('passwd');
    expect(normalizeDownloadFilename('C:\\Users\\dj\\secret.png', { contentType: 'image/png' })).toBe(
      'secret.png',
    );
    expect(normalizeDownloadFilename('a/b/c/photo.jpg', { contentType: 'image/jpeg' })).toBe(
      'photo.jpg',
    );
  });

  it('never leaves a path separator in the output', () => {
    expect(normalizeDownloadFilename('we/ird\\name.jpg', { contentType: 'image/jpeg' })).not.toMatch(
      /[/\\]/,
    );
  });

  it('trims trailing dots and spaces', () => {
    expect(normalizeDownloadFilename('notes...   ')).toBe('notes');
    expect(normalizeDownloadFilename('shot .jpg', { contentType: 'image/jpeg' })).toBe('shot.jpg');
  });

  it('falls back to a neutral stem when sanitization leaves nothing', () => {
    expect(normalizeDownloadFilename('')).toBe(DOWNLOAD_FILENAME_FALLBACK_STEM);
    expect(normalizeDownloadFilename(null)).toBe(DOWNLOAD_FILENAME_FALLBACK_STEM);
    expect(normalizeDownloadFilename(undefined)).toBe(DOWNLOAD_FILENAME_FALLBACK_STEM);
    expect(normalizeDownloadFilename('...')).toBe(DOWNLOAD_FILENAME_FALLBACK_STEM);
    expect(normalizeDownloadFilename('"""')).toBe(DOWNLOAD_FILENAME_FALLBACK_STEM);
    expect(normalizeDownloadFilename('   ', { contentType: 'image/png' })).toBe(
      `${DOWNLOAD_FILENAME_FALLBACK_STEM}.png`,
    );
  });

  it('defuses Windows reserved device names', () => {
    expect(normalizeDownloadFilename('CON.txt')).toBe('_CON.txt');
    expect(normalizeDownloadFilename('nul')).toBe('_nul');
    expect(normalizeDownloadFilename('COM1.png', { contentType: 'image/png' })).toBe('_COM1.png');
    expect(normalizeDownloadFilename('lpt9.jpg', { contentType: 'image/jpeg' })).toBe('_lpt9.jpg');
  });

  it('leaves a merely reserved-looking name alone', () => {
    expect(normalizeDownloadFilename('CONSOLE.txt')).toBe('CONSOLE.txt');
    expect(normalizeDownloadFilename('com10.txt')).toBe('com10.txt');
  });

  it('corrects the extension to the SERVED contentType', () => {
    expect(normalizeDownloadFilename('photo.png', { contentType: 'image/jpeg' })).toBe('photo.jpg');
    expect(normalizeDownloadFilename('clip.mov', { contentType: 'video/mp4' })).toBe('clip.mp4');
    expect(normalizeDownloadFilename('song.wav', { contentType: 'audio/mpeg' })).toBe('song.mp3');
  });

  it('appends the extension when the name has none', () => {
    expect(normalizeDownloadFilename('photo', { contentType: 'image/webp' })).toBe('photo.webp');
  });

  it('keeps an accepted alias and lowercases the extension', () => {
    expect(normalizeDownloadFilename('photo.jpeg', { contentType: 'image/jpeg' })).toBe(
      'photo.jpeg',
    );
    expect(normalizeDownloadFilename('photo.JPG', { contentType: 'image/jpeg' })).toBe('photo.jpg');
  });

  it('ignores contentType parameters and non-canonical spellings', () => {
    expect(normalizeDownloadFilename('photo', { contentType: 'image/PNG; charset=binary' })).toBe(
      'photo.png',
    );
    expect(normalizeDownloadFilename('photo', { contentType: 'image/jpg' })).toBe('photo.jpg');
  });

  it('leaves the input extension alone for an unknown contentType', () => {
    expect(normalizeDownloadFilename('archive.zip', { contentType: 'application/zip' })).toBe(
      'archive.zip',
    );
    expect(extensionForContentType('application/zip')).toBeNull();
    expect(extensionForContentType(undefined)).toBeNull();
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
  });

  it('caps by UTF-8 BYTE length without splitting a multibyte code point', () => {
    const out = normalizeDownloadFilename(`${'é'.repeat(500)}.jpg`, { contentType: 'image/jpeg' });
    expect(utf8Len(out)).toBe(MAX_DOWNLOAD_FILENAME_BYTES);
    expect(out).toBe(`${'é'.repeat(98)}.jpg`);
    expect(out).not.toMatch(/\uFFFD/);
  });

  it('caps without splitting a surrogate pair', () => {
    const out = normalizeDownloadFilename(`${'🎬'.repeat(100)}.mp4`, { contentType: 'video/mp4' });
    expect(utf8Len(out)).toBeLessThanOrEqual(MAX_DOWNLOAD_FILENAME_BYTES);
    expect(out).toBe(`${'🎬'.repeat(49)}.mp4`);
    // Every code point survived whole — no lone surrogate left behind.
    expect([...out].every((cp) => !/[\uD800-\uDFFF]/.test(cp) || cp.length === 2)).toBe(true);
  });

  it('drops a whole code point rather than emit a partial one at an odd boundary', () => {
    const out = normalizeDownloadFilename(`${'🎬'.repeat(5)}.jpg`, {
      contentType: 'image/jpeg',
      maxBytes: 11,
    });
    expect(out).toBe('🎬.jpg');
    expect(utf8Len(out)).toBeLessThanOrEqual(11);
  });

  it('always keeps the extension when truncating', () => {
    const out = normalizeDownloadFilename(`${'a'.repeat(1000)}.png`, { contentType: 'image/png' });
    expect(out.endsWith('.png')).toBe(true);
    expect(utf8Len(out)).toBe(MAX_DOWNLOAD_FILENAME_BYTES);
  });

  it('is idempotent — re-running the Worker-side defensive pass changes nothing', () => {
    const inputs = [
      'report.pdf',
      'café résumé.png',
      '🎬 final cut.mp4',
      'CON.txt',
      '../../etc/passwd',
      `${'é'.repeat(500)}.jpg`,
      '',
    ];
    for (const input of inputs) {
      const once = normalizeDownloadFilename(input, { contentType: 'image/jpeg' });
      expect(normalizeDownloadFilename(once, { contentType: 'image/jpeg' })).toBe(once);
    }
  });

  it('never returns an empty string', () => {
    for (const input of ['', '   ', '...', '"""', '/', '\\', '\u0000', '..']) {
      expect(normalizeDownloadFilename(input).length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// RFC 6266 / RFC 8187 forms
// ===========================================================================

describe('buildContentDispositionFilenameForms', () => {
  it('leaves a plain ASCII name identical in both forms', () => {
    const forms = buildContentDispositionFilenameForms('report.pdf', {
      contentType: 'application/pdf',
    });
    expect(forms.asciiFallback).toBe('report.pdf');
    expect(forms.extendedValue).toBe("UTF-8''report.pdf");
  });

  it('percent-encodes spaces in the RFC 8187 form', () => {
    const forms = buildContentDispositionFilenameForms('my photo.jpg', {
      contentType: 'image/jpeg',
    });
    expect(forms.asciiFallback).toBe('my photo.jpg');
    expect(forms.extendedValue).toBe("UTF-8''my%20photo.jpg");
  });

  it('percent-encodes Unicode as UTF-8 and degrades the ASCII fallback', () => {
    const forms = buildContentDispositionFilenameForms('café résumé.png', {
      contentType: 'image/png',
    });
    expect(forms.asciiFallback).toBe('cafe resume.png');
    expect(forms.extendedValue).toBe("UTF-8''caf%C3%A9%20r%C3%A9sum%C3%A9.png");
  });

  it('percent-encodes emoji byte-by-byte and drops them from the ASCII fallback', () => {
    const forms = buildContentDispositionFilenameForms('🎬 final cut.mp4', {
      contentType: 'video/mp4',
    });
    expect(forms.asciiFallback).toBe('final cut.mp4');
    expect(forms.extendedValue).toBe("UTF-8''%F0%9F%8E%AC%20final%20cut.mp4");
  });

  it('falls back to the neutral stem when nothing ASCII survives', () => {
    const forms = buildContentDispositionFilenameForms('日本語.png', { contentType: 'image/png' });
    expect(forms.asciiFallback).toBe(`${DOWNLOAD_FILENAME_FALLBACK_STEM}.png`);
    expect(forms.extendedValue).toBe("UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.png");
  });

  it('defensively re-normalizes, so a raw record value can never reach the header', () => {
    const forms = buildContentDispositionFilenameForms('evil"\r\nX-Injected: 1/../boom.png', {
      contentType: 'image/png',
    });
    expect(forms.asciiFallback).not.toMatch(/["\\\r\n;,]/);
    expect(forms.extendedValue).not.toMatch(/["\\\r\n;,]/);
    expect(forms.extendedValue.startsWith("UTF-8''")).toBe(true);
  });

  it('emits an ASCII fallback that is safe inside a quoted-string, for every shape', () => {
    const inputs = [
      'report.pdf',
      'my photo.jpg',
      'café résumé.png',
      '🎬 final cut.mp4',
      '日本語.png',
      'he said "hi".txt',
      '../../etc/passwd',
      'CON.txt',
      `${'é'.repeat(500)}.jpg`,
      '',
    ];
    for (const input of inputs) {
      const forms = buildContentDispositionFilenameForms(input);
      expect(forms.asciiFallback.length).toBeGreaterThan(0);
      expect(forms.asciiFallback).toMatch(/^[\u0020-\u007E]+$/);
      expect(forms.asciiFallback).not.toMatch(/["\\;,]/);
      // An ext-value is unquoted — only attr-chars and %XX escapes may appear.
      expect(forms.extendedValue).toMatch(/^UTF-8''(?:[A-Za-z0-9!#$&+\-.^_`|~]|%[0-9A-F]{2})+$/);
    }
  });
});
