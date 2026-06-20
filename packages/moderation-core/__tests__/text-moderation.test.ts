import { describe, it, expect, vi } from 'vitest';
import {
  createWordListCache,
  quickWordFilter,
  moderateText,
} from '../src/server/text-moderation.js';

describe('createWordListCache', () => {
  it('loads on first call', async () => {
    const loader = vi.fn().mockResolvedValue(['badword']);
    const cache = createWordListCache({ loader, ttlMs: 60_000 });
    const words = await cache.getWords();
    expect(words.has('badword')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns cached result within TTL without calling loader again', async () => {
    const loader = vi.fn().mockResolvedValue(['badword']);
    const cache = createWordListCache({ loader, ttlMs: 60_000 });
    await cache.getWords();
    await cache.getWords();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after TTL expires (ttlMs=0 expires immediately)', async () => {
    const loader = vi.fn().mockResolvedValue(['badword']);
    const cache = createWordListCache({ loader, ttlMs: 0 });
    await cache.getWords();
    await new Promise(r => setTimeout(r, 5));
    await cache.getWords();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('__reset clears cache and forces reload', async () => {
    const loader = vi.fn().mockResolvedValue(['badword']);
    const cache = createWordListCache({ loader, ttlMs: 60_000 });
    await cache.getWords();
    cache.__reset();
    await cache.getWords();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('quickWordFilter', () => {
  it('passes when word list is empty', async () => {
    const wordList = { getWords: async () => new Set<string>() };
    const result = await quickWordFilter('hello world', wordList);
    expect(result.pass).toBe(true);
    expect(result.flaggedWords).toEqual([]);
  });

  it('flags when text contains a word from the list', async () => {
    const wordList = { getWords: async () => new Set(['badword']) };
    const result = await quickWordFilter('this is a badword sentence', wordList);
    expect(result.pass).toBe(false);
    expect(result.flaggedWords).toContain('badword');
  });

  it('normalizes leet speak — b4dge matches badge in the list', async () => {
    // 4 → a, so "b4dge" normalizes to "badge"
    const wordList = { getWords: async () => new Set(['badge']) };
    const result = await quickWordFilter('b4dge', wordList);
    expect(result.pass).toBe(false);
    expect(result.flaggedWords).toContain('badge');
  });

  it('does not flag clean text against populated word list', async () => {
    const wordList = { getWords: async () => new Set(['badword', 'other']) };
    const result = await quickWordFilter('this is perfectly fine', wordList);
    expect(result.pass).toBe(true);
    expect(result.flaggedWords).toEqual([]);
  });
});

describe('moderateText', () => {
  it('returns { safe: true } for text below minLength without calling word list', async () => {
    const getWords = vi.fn();
    const wordList = { getWords };
    const result = await moderateText('hi', {
      wordList,
      minLength: 10,
    });
    expect(result.safe).toBe(true);
    expect(getWords).not.toHaveBeenCalled();
  });

  it('word filter rejects prohibited language', async () => {
    const wordList = { getWords: async () => new Set(['badword']) };
    const result = await moderateText('a badword sentence', { wordList });
    expect(result.safe).toBe(false);
    expect(result.layer).toBe('word_filter');
    expect(result.flaggedWords).toContain('badword');
  });

  it('passes clean text against a populated word list', async () => {
    const wordList = { getWords: async () => new Set(['badword']) };
    const result = await moderateText('some content here', { wordList });
    expect(result.safe).toBe(true);
    expect(result.layer).toBeUndefined();
  });

  it('returns { safe: true } for empty text', async () => {
    const wordList = { getWords: async () => new Set<string>() };
    const result = await moderateText('', { wordList });
    expect(result.safe).toBe(true);
  });
});
