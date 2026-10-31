import type { SquareStreetzPostType } from '../doc-schemas/social.js';
import { APP_ROUTES } from './app-routes.js';

export type TownCrierDestinationKind = 'audition' | 'commission' | 'hallItem';

export interface TownCrierDestination {
  readonly kind: TownCrierDestinationKind;
  readonly href: string;
}

export function townCrierPostDestination(post: {
  readonly postType: SquareStreetzPostType;
  readonly relatedAssetId?: string;
}): TownCrierDestination | null {
  const assetId = post.relatedAssetId;
  if (assetId === undefined || assetId === '') return null;
  switch (post.postType) {
    case 'NEW_AUDITION':
      return { kind: 'audition', href: APP_ROUTES.audition(assetId) };
    case 'NEW_COMMISSION':
      return { kind: 'commission', href: APP_ROUTES.commission(assetId) };
    case 'LIBRARY_PUBLISHED':
      return { kind: 'hallItem', href: APP_ROUTES.hallItem(assetId) };
    default:
      return null;
  }
}
