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
  reasonScores: Record<string, number>;
  itemTypeMultipliers: Record<string, number>;
  additionalReportBonus: number;
  defaultReasonScore: number;
  defaultItemTypeMultiplier: number;
}
