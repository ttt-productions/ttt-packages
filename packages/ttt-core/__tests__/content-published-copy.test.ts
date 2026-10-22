import { describe, it, expect } from 'vitest';
import {
  contentPublishedNotificationCopy,
  contentPublishedStoredCopy,
} from '../src/notifications/content-published-copy.js';

const titles = { workTitle: 'The Long Road', subItemTitle: 'Chapter One' };

describe('content-published notification copy', () => {
  it("a follower's card names the Work and the published item it is given", () => {
    expect(
      contentPublishedNotificationCopy({ type: 'followed_content_published', count: 1, ...titles }),
    ).toEqual({ title: 'New in The Long Road', message: '"Chapter One" was published' });
  });

  it("a member's card names their Work and the published item it is given", () => {
    expect(
      contentPublishedNotificationCopy({ type: 'member_content_published', count: 1, ...titles }),
    ).toEqual({
      title: 'Your work "The Long Road" was published',
      message: '"Chapter One" is now in the Hall Library',
    });
  });

  it('a card for several published items counts them under the named Work', () => {
    expect(
      contentPublishedNotificationCopy({ type: 'followed_content_published', count: 3, ...titles }),
    ).toEqual({ title: 'New in The Long Road', message: '3 new items published' });
    expect(
      contentPublishedNotificationCopy({ type: 'member_content_published', count: 3, ...titles }),
    ).toEqual({
      title: 'Your work "The Long Road" was published',
      message: '3 of your items were published to the Hall Library',
    });
  });

  it('the stored text names no Work or item', () => {
    expect(
      contentPublishedStoredCopy({
        type: 'followed_content_published',
        count: 1,
        hallSubItemType: 'chapter',
      }),
    ).toEqual({ title: 'New in the Hall Library', message: 'A new chapter was published' });
    expect(
      contentPublishedStoredCopy({
        type: 'member_content_published',
        count: 1,
        hallSubItemType: 'track',
      }),
    ).toEqual({
      title: 'Your work was published',
      message: 'A new track is now in the Hall Library',
    });
  });
});
