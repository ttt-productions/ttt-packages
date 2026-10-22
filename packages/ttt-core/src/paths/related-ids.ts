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
