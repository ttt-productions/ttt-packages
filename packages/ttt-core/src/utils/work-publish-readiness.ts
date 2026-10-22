import { MAX_WORK_PROJECT_STAKE_SHARES } from '../constants/business-work-project.js';
import {
  FOUNDING_WORK_HOLDER_TYPE,
  type FullWorkProject,
  type GuildmateUser,
  type WorkRealm,
} from '../doc-schemas/work-project.js';
import type { FullTale, FullTelevision, FullTune } from '../doc-schemas/content.js';

export const WORK_PUBLISH_REQUIREMENT_LABELS = {
  title: 'Work project title is set',
  description: 'Work project description is set',
  covers: 'All 3 work project cover photos are uploaded',
  genres: 'Work project has at least one genre',
  realmCover: 'Founding Realm cover is uploaded',
  shares: `Total work project shares equal ${MAX_WORK_PROJECT_STAKE_SHARES}`,
  collaborators: 'Each collaborator has at least 1 share and 1 trade profession',
} as const;

export type WorkPublishRequirement = keyof typeof WORK_PUBLISH_REQUIREMENT_LABELS;

export type WorkPublishReadinessWork = Pick<
  FullWorkProject,
  'status' | 'workingTitle' | 'workingDescription'
>;

export type WorkPublishReadinessSection = Pick<
  FullTale | FullTune | FullTelevision,
  'coverSquareAssetId' | 'coverPosterAssetId' | 'coverCinematicAssetId' | 'workGenres'
>;

export type WorkPublishReadinessGuildmate = Pick<
  GuildmateUser,
  'status' | 'holderType' | 'stakeShareCount' | 'tradeProfessions'
>;

export type WorkPublishReadinessRealm = Pick<
  WorkRealm,
  'realmType' | 'realmStatus' | 'realmCoverAssetId'
>;

export interface WorkPublishReadinessInput {
  readonly work: WorkPublishReadinessWork;
  readonly section: WorkPublishReadinessSection;
  readonly guildmates: ReadonlyArray<WorkPublishReadinessGuildmate>;
  readonly realm: WorkPublishReadinessRealm | null;
}

export interface WorkPublishRequirementCheck {
  readonly requirement: WorkPublishRequirement;
  readonly met: boolean;
}

export interface WorkPublishReadiness {
  readonly firstPublication: boolean;
  readonly checks: ReadonlyArray<WorkPublishRequirementCheck>;
  readonly unmet: ReadonlyArray<WorkPublishRequirement>;
  readonly totalShares: number;
  readonly ready: boolean;
}

export function isWorkFirstPublication(work: Pick<FullWorkProject, 'status'>): boolean {
  return work.status !== 'published';
}

export function realmCoverSubmitRule(
  realm: WorkPublishReadinessRealm | null,
): { readonly met: boolean } | null {
  if (realm === null || realm.realmType !== 'public' || realm.realmStatus !== 'draft') return null;
  return { met: typeof realm.realmCoverAssetId === 'string' && realm.realmCoverAssetId.length > 0 };
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAsset(assetId: string | undefined): boolean {
  return typeof assetId === 'string' && assetId.length > 0;
}

export function checkWorkPublishReadiness(input: WorkPublishReadinessInput): WorkPublishReadiness {
  const { work, section, guildmates, realm } = input;
  const firstPublication = isWorkFirstPublication(work);
  const active = guildmates.filter((member) => member.status === 'active');
  const totalShares = active.reduce((sum, member) => sum + (member.stakeShareCount || 0), 0);

  const checks: WorkPublishRequirementCheck[] = [];
  if (firstPublication) {
    const collaborators = active.filter(
      (member) => member.holderType !== FOUNDING_WORK_HOLDER_TYPE,
    );
    checks.push(
      { requirement: 'title', met: hasText(work.workingTitle) },
      { requirement: 'description', met: hasText(work.workingDescription) },
      {
        requirement: 'covers',
        met:
          hasAsset(section.coverSquareAssetId) &&
          hasAsset(section.coverPosterAssetId) &&
          hasAsset(section.coverCinematicAssetId),
      },
      { requirement: 'genres', met: (section.workGenres ?? []).length > 0 },
    );
    const realmCover = realmCoverSubmitRule(realm);
    if (realmCover) checks.push({ requirement: 'realmCover', met: realmCover.met });
    checks.push(
      { requirement: 'shares', met: totalShares === MAX_WORK_PROJECT_STAKE_SHARES },
      {
        requirement: 'collaborators',
        met: collaborators.every(
          (member) =>
            (member.stakeShareCount || 0) > 0 && (member.tradeProfessions || []).length > 0,
        ),
      },
    );
  } else {
    const realmCover = realmCoverSubmitRule(realm);
    if (realmCover) checks.push({ requirement: 'realmCover', met: realmCover.met });
  }

  const unmet = checks.filter((check) => !check.met).map((check) => check.requirement);
  return { firstPublication, checks, unmet, totalShares, ready: unmet.length === 0 };
}
