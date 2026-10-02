// Typed ids for relationship arrays that mix entity kinds (a Square post's `relatedIds`): each id
// carries its kind's prefix, so ids of different kinds never collide (BACKEND-206). Every
// MentionType is a kind here, so a post can relate every entity it mentions.

import type { MentionType } from '../media/atoms.js';

export const RELATED_ID_PREFIXES = {
  user: 'user_',
  workProject: 'workProject_',
  workRealm: 'workRealm_',
  commission: 'commission_',
  audition: 'audition_',
} as const satisfies Record<MentionType, string>;

export type RelatedIdEntity = keyof typeof RELATED_ID_PREFIXES;

export function buildRelatedId(entity: RelatedIdEntity, id: string): string {
  return `${RELATED_ID_PREFIXES[entity]}${id}`;
}
