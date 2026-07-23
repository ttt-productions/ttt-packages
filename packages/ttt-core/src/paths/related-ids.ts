// Typed prefixes for structured relationship-array IDs (e.g. SquareStreetz post `relatedIds`).
// Structured relationship arrays that mix entity types MUST store typed IDs using these
// underscore prefixes. See docs/design/work-realm-discovery-system.md and
// engineering-rules BACKEND-206 (ttt-master-app/docs/engineering-rules/backend/sensitive-writes-and-audit.md).

export const RELATED_ID_PREFIXES = {
  user: 'user_',
  workProject: 'workProject_',
  workRealm: 'workRealm_',
} as const;

export type RelatedIdEntity = keyof typeof RELATED_ID_PREFIXES;

export function buildRelatedId(entity: RelatedIdEntity, id: string): string {
  return `${RELATED_ID_PREFIXES[entity]}${id}`;
}
