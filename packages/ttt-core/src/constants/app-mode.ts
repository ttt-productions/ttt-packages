import type { WorkProjectType } from '../types/content.js';
import { GIB, MIB } from './byte-units.js';

export const APP_MODES = ['charter', 'full'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const APP_MODE: AppMode = 'charter';

export const valueInMode = <T>(mode: AppMode, charter: T, full: T): T =>
  mode === 'charter' ? charter : full;

export const byMode = <T>(charter: T, full: T): T => valueInMode(APP_MODE, charter, full);

export interface TttLimits {
  mode: AppMode;
  user: {
    maxCraftSkills: number;
    maxOwnedWorkProjects: number;
    maxAssociatedWorkProjects: number;
  };
  workProject: {
    maxGuildSize: number;
    maxFileFolders: number;
    maxWorkFiles: number;
    maxWorkFileStorageBytes: number;
    maxWorkProjectAuditions: number;
    maxCommissionListings: number;
    maxChapters: number;
    maxChapterContentLength: number;
    maxTuneTracks: number;
    maxTelevisionEpisodes: number;
  };
  conversation: {
    maxConversationFiles: number;
    maxConversationFileStorageBytes: number;
  };
  hall: {
    maxSubmitBatch: number;
  };
  batches: {
    trendingFeedProcessLimit: number;
    maxFeedbackSubmitters: number;
  };
}

export const CHARTER_LIMITS: TttLimits = {
  mode: 'charter',
  user: {
    maxCraftSkills: 8,
    maxOwnedWorkProjects: 3,
    maxAssociatedWorkProjects: 10,
  },
  workProject: {
    maxGuildSize: 25,
    maxFileFolders: 10,
    maxWorkFiles: 100,
    maxWorkFileStorageBytes: 2.5 * GIB,
    maxWorkProjectAuditions: 3,
    maxCommissionListings: 3,
    maxChapters: 5,
    maxChapterContentLength: 30_000,
    maxTuneTracks: 5,
    maxTelevisionEpisodes: 3,
  },
  conversation: {
    maxConversationFiles: 10,
    maxConversationFileStorageBytes: 500 * MIB,
  },
  hall: { maxSubmitBatch: 10 },
  batches: { trendingFeedProcessLimit: 250, maxFeedbackSubmitters: 25 },
};

export const FULL_LIMITS: TttLimits = {
  mode: 'full',
  user: {
    maxCraftSkills: 24,
    maxOwnedWorkProjects: 25,
    maxAssociatedWorkProjects: 100,
  },
  workProject: {
    maxGuildSize: 250,
    maxFileFolders: 25,
    maxWorkFiles: 1000,
    maxWorkFileStorageBytes: 25 * GIB,
    maxWorkProjectAuditions: 10,
    maxCommissionListings: 10,
    maxChapters: 50,
    // Far inside Firestore's 1 MiB document limit.
    maxChapterContentLength: 100_000,
    maxTuneTracks: 50,
    maxTelevisionEpisodes: 25,
  },
  conversation: {
    maxConversationFiles: 20,
    maxConversationFileStorageBytes: 1 * GIB,
  },
  hall: { maxSubmitBatch: 50 },
  batches: { trendingFeedProcessLimit: 1000, maxFeedbackSubmitters: 100 },
};

export const ACTIVE_LIMITS: TttLimits = byMode(CHARTER_LIMITS, FULL_LIMITS);

const largestInAnyMode = (pick: (limits: TttLimits) => number): number =>
  Math.max(pick(CHARTER_LIMITS), pick(FULL_LIMITS));

export const HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE: Readonly<Record<WorkProjectType, number>> = {
  Tales: largestInAnyMode((limits) => limits.workProject.maxChapters),
  Tunes: largestInAnyMode((limits) => limits.workProject.maxTuneTracks),
  Television: largestInAnyMode((limits) => limits.workProject.maxTelevisionEpisodes),
};

export const countCapReachedMessage = (
  subject: string,
  limit: number,
  noun: string,
  hint?: string,
): string => {
  const base = byMode(
    `${subject} already has the Charter Season maximum of ${limit} ${noun} — caps expand when Charter Season ends.`,
    `${subject} already has the maximum of ${limit} ${noun}.`,
  );
  return hint ? `${base} ${hint}` : base;
};
