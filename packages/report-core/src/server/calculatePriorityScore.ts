import type { ServerReportCoreConfig } from './types.js';

export function calculatePriorityScore(
  config: ServerReportCoreConfig['priorityConfig'],
  reason: string,
  itemType: string,
  reportCount: number,
): number {
  const reasonScore = config.reasonScores[reason] ?? config.defaultReasonScore;

  const itemMultiplier = config.itemTypeMultipliers[itemType] ?? config.defaultItemTypeMultiplier;

  const bonusReports = Math.max(0, reportCount - 1);
  const bonus = bonusReports * config.additionalReportBonus;

  return reasonScore * itemMultiplier + bonus;
}

export function getHighestScoringReason(
  config: ServerReportCoreConfig['priorityConfig'],
  reasons: string[],
): string {
  if (reasons.length === 0) return '';

  let highest = reasons[0];
  let highestScore = config.reasonScores[highest] ?? config.defaultReasonScore;

  for (let i = 1; i < reasons.length; i++) {
    const score = config.reasonScores[reasons[i]] ?? config.defaultReasonScore;
    if (score > highestScore) {
      highest = reasons[i];
      highestScore = score;
    }
  }

  return highest;
}
