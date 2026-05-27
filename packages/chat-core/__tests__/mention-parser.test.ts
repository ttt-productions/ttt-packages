import { describe, it, expect } from 'vitest';
import { parseMentionTokens, formatMentionToken } from '../src/mentions/parser.js';

describe('parseMentionTokens', () => {
  it('returns empty array for empty string', () => {
    expect(parseMentionTokens('')).toEqual([]);
  });

  it('returns single text segment for plain text', () => {
    expect(parseMentionTokens('hello world')).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('parses a single mention with displayText', () => {
    expect(parseMentionTokens('@[user:abc|Alice]')).toEqual([
      { type: 'mention', ref: { kind: 'user', id: 'abc', displayText: 'Alice' } },
    ]);
  });

  it('parses a mention without displayText, defaulting displayText to id', () => {
    expect(parseMentionTokens('@[user:abc]')).toEqual([
      { type: 'mention', ref: { kind: 'user', id: 'abc', displayText: 'abc' } },
    ]);
  });

  it('parses text + mention + text', () => {
    expect(parseMentionTokens('hi @[user:abc|Alice], how are you?')).toEqual([
      { type: 'text', text: 'hi ' },
      { type: 'mention', ref: { kind: 'user', id: 'abc', displayText: 'Alice' } },
      { type: 'text', text: ', how are you?' },
    ]);
  });

  it('parses multiple mentions of different kinds', () => {
    const segments = parseMentionTokens('@[user:u1|Alice] and @[entity:e1|Sample Entity]');
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ type: 'mention', ref: { kind: 'user', id: 'u1', displayText: 'Alice' } });
    expect(segments[1]).toEqual({ type: 'text', text: ' and ' });
    expect(segments[2]).toEqual({ type: 'mention', ref: { kind: 'entity', id: 'e1', displayText: 'Sample Entity' } });
  });

  it('treats unterminated tokens as plain text', () => {
    expect(parseMentionTokens('text @[user:abc unterminated')).toEqual([
      { type: 'text', text: 'text @[user:abc unterminated' },
    ]);
  });

  it('treats malformed kind characters as plain text', () => {
    expect(parseMentionTokens('@[us er:abc]')).toEqual([
      { type: 'text', text: '@[us er:abc]' },
    ]);
  });

  it('treats missing colon as plain text', () => {
    expect(parseMentionTokens('@[user abc]')).toEqual([
      { type: 'text', text: '@[user abc]' },
    ]);
  });

  it('handles empty displayText fallback (pipe but empty)', () => {
    expect(parseMentionTokens('@[user:abc|]')).toEqual([
      { type: 'mention', ref: { kind: 'user', id: 'abc', displayText: 'abc' } },
    ]);
  });

  it('handles displayText with spaces and special characters', () => {
    expect(parseMentionTokens('@[entity:e1|Sample Entity 2025!]')).toEqual([
      { type: 'mention', ref: { kind: 'entity', id: 'e1', displayText: 'Sample Entity 2025!' } },
    ]);
  });

  it('handles consecutive mentions with no separator', () => {
    const segments = parseMentionTokens('@[user:a|A]@[user:b|B]');
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ type: 'mention', ref: { id: 'a' } });
    expect(segments[1]).toMatchObject({ type: 'mention', ref: { id: 'b' } });
  });
});

describe('formatMentionToken', () => {
  it('formats a basic mention', () => {
    expect(formatMentionToken({ kind: 'user', id: 'abc', displayText: 'Alice' })).toBe('@[user:abc|Alice]');
  });

  it('roundtrips through parseMentionTokens', () => {
    const ref = { kind: 'entity' as const, id: 'e1', displayText: 'Sample Entity' };
    const token = formatMentionToken(ref);
    const parsed = parseMentionTokens(token);
    expect(parsed).toEqual([{ type: 'mention', ref }]);
  });
});
