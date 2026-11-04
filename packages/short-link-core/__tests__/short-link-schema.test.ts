import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createShortLinkSchema, isInAppDestination } from '../src/short-link-schema.js';

const schema = createShortLinkSchema({
  type: z.enum(['thing']),
  metadata: z.object({ thingId: z.string() }),
});

const link = {
  shortId: 'AbC234',
  destinationUrl: '/things/t1',
  type: 'thing',
  metadata: { thingId: 't1' },
  createdAt: 1,
  createdBy: 'u1',
  clicks: 0,
};

describe('createShortLinkSchema', () => {
  it('reads a link with the app target type and metadata plugged in', () => {
    expect(schema.parse(link)).toEqual(link);
  });

  it('refuses a target type the app does not declare', () => {
    expect(schema.safeParse({ ...link, type: 'other' }).success).toBe(false);
  });

  it('stores no full URL: the address is built from the app site URL where it is shown', () => {
    expect(schema.parse({ ...link, shortUrl: 'https://example.test/v/AbC234' })).toEqual(link);
  });

  it('refuses a negative click count', () => {
    expect(schema.safeParse({ ...link, clicks: -1 }).success).toBe(false);
  });
});

describe('isInAppDestination', () => {
  it('accepts an in-app path and refuses a full or protocol-relative URL', () => {
    expect(isInAppDestination('/things/t1')).toBe(true);
    expect(isInAppDestination('https://elsewhere.test/x')).toBe(false);
    expect(isInAppDestination('//elsewhere.test/x')).toBe(false);
    expect(isInAppDestination('things/t1')).toBe(false);
  });
});
