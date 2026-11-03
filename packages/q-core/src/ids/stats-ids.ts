import type { StatsValidationScope } from '../doc-schemas/system.js';
import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';
import { buildRequestJobId, parseRequestJobId } from './request-job-ids.js';
import type { RequestJobIdParts } from './request-job-ids.js';

export function buildStatsJobId(userId: string, requestId: string): string {
  return buildRequestJobId(userId, requestId);
}

export function parseStatsJobId(id: string): RequestJobIdParts | null {
  return parseRequestJobId(id);
}

export const EVERYTHING_STATS_VALIDATION_REPORT_ID = 'everything';

export function buildStatsValidationReportId(scope: StatsValidationScope): string {
  if (scope.gameId !== undefined) return ['game', scope.gameId].join(COMPOUND_ID_SEPARATOR);
  if (scope.leagueId !== undefined) return ['league', scope.leagueId].join(COMPOUND_ID_SEPARATOR);
  return EVERYTHING_STATS_VALIDATION_REPORT_ID;
}
