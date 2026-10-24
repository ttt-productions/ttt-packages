import {
  MediaAuthoritySyncStateSchema,
  type MediaServingStatus,
} from '../doc-schemas/media-assets.js';

export interface MediaAuthorityCoWrite<S extends MediaServingStatus = MediaServingStatus> {
  readonly plainFields: {
    readonly servingStatus: S;
    readonly authoritySyncState: typeof MediaAuthoritySyncStateSchema.enum.pending;
    readonly authoritySyncAttemptCount: 0;
    readonly authoritySyncNextAttemptAt: number;
    readonly updatedAt: number;
  };
  readonly increment: { readonly fieldPath: 'authorityVersion'; readonly by: 1 };
}

export function mediaAuthorityCoWrite<S extends MediaServingStatus>(
  servingStatus: S,
  now: number,
): MediaAuthorityCoWrite<S> {
  return {
    plainFields: {
      servingStatus,
      authoritySyncState: MediaAuthoritySyncStateSchema.enum.pending,
      authoritySyncAttemptCount: 0,
      authoritySyncNextAttemptAt: now,
      updatedAt: now,
    },
    increment: { fieldPath: 'authorityVersion', by: 1 },
  };
}
