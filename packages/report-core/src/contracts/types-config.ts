// Config shapes for the report-core provider — task-queue, reportable items,
// and priority scoring.

export interface TaskQueueConfig {
  displayName: string;
  description: string;
  defaultCheckoutMinutes: number;
  workLaterMinutes: number;
  maxWorkLaterMinutes: number;
}

export interface ReportableItemConfig {
  displayName: string;
}

export interface PriorityConfig {
  /** Base score per reason. Higher = reviewed sooner. */
  reasonScores: Record<string, number>;
  /** Multiplier per item type. More visible content = higher multiplier. */
  itemTypeMultipliers: Record<string, number>;
  /** Bonus points per additional report on the same item. */
  additionalReportBonus: number;
  /** Default score if reason not found in reasonScores. */
  defaultReasonScore: number;
  /** Default multiplier if item type not found in itemTypeMultipliers. */
  defaultItemTypeMultiplier: number;
}
