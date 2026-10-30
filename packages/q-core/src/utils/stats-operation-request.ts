import { canonicalize, hashPayload } from '@ttt-productions/edge-protocol-core';
import type { HistoricalStats } from '../doc-schemas/user-profile.js';
import type { GameStatsCorrectionTarget } from '../schemas/stats.js';
import type { SportKey } from '../types/sports.js';

// What a held operation is bound to: its kind, scope, and values, never its reason.
export type StatsOperationRequest =
  | {
      kind: 'gameStatsCorrection';
      scope: { gameId: string };
      targets?: readonly GameStatsCorrectionTarget[];
      keepStored?: true;
    }
  | {
      kind: 'historicalStatsUpdate';
      scope: { userId: string; sportKey: SportKey };
      stats: HistoricalStats;
    };

// The same targets sent in another order are the same request.
export function hashStatsOperationRequest(request: StatsOperationRequest): Promise<string> {
  if (request.kind !== 'gameStatsCorrection' || request.targets === undefined) {
    return hashPayload(request);
  }
  const targets = [...request.targets].sort((left, right) =>
    canonicalize(left) < canonicalize(right) ? -1 : 1,
  );
  return hashPayload({ ...request, targets });
}
