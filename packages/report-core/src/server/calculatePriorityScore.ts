import type { ServerReportCoreConfig } from './types.js';

/**
 * Calculate a priority score for a report group.
 *
 * Formula: score = reasonScore × itemTypeMultiplier + (reportCount - 1) × additionalReportBonus
 *
 * When a group has multiple reasons, the highest reason score is used.
 *
 * @param config - The priority config from ReportCoreConfig
 * @param reason - The report reason (or highest-scoring reason in the group)
 * @param itemType - The reported item type
 * @param reportCount - Total number of reports in the group
 * @returns Numeric priority score (higher = reviewed sooner)
 */
export function calculatePriorityScore(
  config: ServerReportCoreConfig['priorityConfig'],
  reason: string,
  itemType: string,
  reportCount: number,
): number {
  const reasonScore =
    config.reasonScores[reason] ?? config.defaultReasonScore;

  const itemMultiplier =
    config.itemTypeMultipliers[itemType] ?? config.defaultItemTypeMultiplier;

  const bonusReports = Math.max(0, reportCount - 1);
  const bonus = bonusReports * config.additionalReportBonus;

  return reasonScore * itemMultiplier + bonus;
}

/**
 * Given multiple reasons, return the one with the highest score.
 */
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
