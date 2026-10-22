import { describe, it, expect } from 'vitest';
import {
  ASSET_LEVEL_BLOCK_ITEM_TYPES,
  HALL_LIBRARY_TARGET_TYPES,
  MEDIA_SERVING_ONLY_ITEM_TYPES,
  MODERATABLE_ITEM_TYPES,
  SINGLE_DOC_HIDE_RESTORE_TARGET_TYPES,
  SINGLE_DOC_TARGET_TYPES,
} from '../src/doc-schemas/safety/foundation.js';
import {
  MEDIA_DISPLAY_VARIANT_PRECEDENCE,
  PROFILE_PICTURE_VARIANT_KEYS,
} from '../src/doc-schemas/media-assets.js';
import {
  NOTIFICATION_TYPE_VALUES,
  REALTIME_RELIABLE_NOTIFICATION_TYPES,
  RELIABLE_NOTIFICATION_TYPES,
} from '../src/schemas/notification.js';
import { PLEDGE_REFUND_EVENT_REQUEST_STATUSES } from '../src/doc-schemas/payments.js';
import { PLEDGE_DISPUTE_LOST_STAMPED_FIELDS } from '../src/utils/pledge-totals.js';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';

describe('moderation target groups', () => {
  it('a craft skill is not single-doc moderatable: it spans its per-user doc and tag mirrors', () => {
    expect(MODERATABLE_ITEM_TYPES).not.toContain('craft-skill');
  });

  it('a Hall sub-item takes hide and restore but never the single-doc perma-remove', () => {
    expect(SINGLE_DOC_TARGET_TYPES).not.toContain('hall-library-sub-item');
    expect(SINGLE_DOC_HIDE_RESTORE_TARGET_TYPES).toEqual([
      ...SINGLE_DOC_TARGET_TYPES,
      'hall-library-sub-item',
    ]);
  });

  it('only the shared-file surfaces are hidden by an asset-level block', () => {
    expect([...ASSET_LEVEL_BLOCK_ITEM_TYPES].sort()).toEqual(['conversation-file', 'work-asset']);
    expect([...MEDIA_SERVING_ONLY_ITEM_TYPES].sort()).toEqual([
      'conversation-file',
      'profile-picture',
      'work-asset',
    ]);
  });

  it('the full-page preview is offered for Hall items and their sub-items', () => {
    expect([...HALL_LIBRARY_TARGET_TYPES].sort()).toEqual([
      'hall-library-item',
      'hall-library-sub-item',
    ]);
  });
});

describe('media variant subsets', () => {
  it('a profile picture is produced in exactly the sizes its spec declares', () => {
    const spec = TTT_MEDIA_SPECS['profile-picture'].processing as {
      image: { image: { variants: { key: string }[] } };
    };
    expect(spec.image.image.variants.map((variant) => variant.key)).toEqual([
      ...PROFILE_PICTURE_VARIANT_KEYS,
    ]);
  });

  it('a single display renders the largest servable variant first', () => {
    expect(MEDIA_DISPLAY_VARIANT_PRECEDENCE).toEqual(['main', 'full', 'medium', 'small']);
  });
});

describe('notification lanes', () => {
  it('the broadcast and audience-fanout types never ride the reliable lane', () => {
    for (const fanout of [
      'admin_announcement',
      'followed_content_published',
      'member_content_published',
      'followed_craft_skill_published',
    ]) {
      expect(RELIABLE_NOTIFICATION_TYPES).not.toContain(fanout);
    }
    expect(
      [
        ...RELIABLE_NOTIFICATION_TYPES,
        'admin_announcement',
        'followed_content_published',
        'member_content_published',
        'followed_craft_skill_published',
      ].sort(),
    ).toEqual([...NOTIFICATION_TYPE_VALUES].sort());
  });

  it('the admin queue and its thread messages materialize inline at their origin', () => {
    expect([...REALTIME_RELIABLE_NOTIFICATION_TYPES].sort()).toEqual([
      'admin_dispatch_created',
      'admin_dispatch_reply',
      'content_report',
    ]);
  });
});

describe('pledge subsets', () => {
  it('a refund event settles a request to completed or failed, never another status', () => {
    expect([...PLEDGE_REFUND_EVENT_REQUEST_STATUSES].sort()).toEqual(['completed', 'failed']);
  });

  it('a lost dispute stamps the withdrawn amount and the recomputed net', () => {
    expect([...PLEDGE_DISPUTE_LOST_STAMPED_FIELDS].sort()).toEqual([
      'disputeLostAmount',
      'netAmount',
    ]);
  });
});
