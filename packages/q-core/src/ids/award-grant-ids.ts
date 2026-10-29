// Award group grant ids. Every decision on one award for one group shares that pair's target key,
// and each decision's record id is the key plus its decision number — deterministic, so two
// decisions racing for the same number write the same document and conflict instead of both
// committing (RULE-STD-BACKEND-304).

import type { AwardGroupType } from '../types/unions.js';

export interface AwardGroupGrantTarget {
  readonly awardId: string;
  readonly groupType: AwardGroupType;
  readonly groupId: string;
}

// A part prefixed by its length, so parts that contain any character still decode one way.
const lengthPrefixed = (part: string): string => `${part.length}:${part}`;

const DECISION_SEPARATOR = '~';

// The key every decision on one award for one group shares.
export function buildAwardGroupGrantTargetKey(target: AwardGroupGrantTarget): string {
  return [target.awardId, target.groupType, target.groupId].map(lengthPrefixed).join('');
}

// awardGroupGrants/{targetKey}~{decision}. The target key is length-prefixed throughout, so the
// decision after the last separator decodes one way.
export function buildAwardGroupGrantId(targetKey: string, decision: number): string {
  return `${targetKey}${DECISION_SEPARATOR}${decision}`;
}
