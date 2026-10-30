import type { AwardGroupType } from '../types/unions.js';

export interface AwardGroupGrantTarget {
  readonly awardId: string;
  readonly groupType: AwardGroupType;
  readonly groupId: string;
}

// A part prefixed by its length, so parts that contain any character still decode one way.
const lengthPrefixed = (part: string): string => `${part.length}:${part}`;

const DECISION_SEPARATOR = '~';

export function buildAwardGroupGrantTargetKey(target: AwardGroupGrantTarget): string {
  return [target.awardId, target.groupType, target.groupId].map(lengthPrefixed).join('');
}

export function buildAwardGroupGrantId(targetKey: string, decision: number): string {
  return `${targetKey}${DECISION_SEPARATOR}${decision}`;
}
