// The Work-level publish-readiness rule: what a Work must carry before its content may be
// submitted, approved, and published to the Hall. ONE owner for the member-side Publish checklist
// and the submit, approve, and publish cores, beside the sub-item rule
// (`unmetHallSubItemRequirements`). Server-safe: constants and plain functions only.

import { MAX_WORK_PROJECT_STAKE_SHARES } from '../constants/business-work-project.js';
import {
  FOUNDING_WORK_HOLDER_TYPE,
  type FullWorkProject,
  type GuildmateUser,
  type WorkRealm,
} from '../doc-schemas/work-project.js';
import type { FullTale, FullTelevision, FullTune } from '../doc-schemas/content.js';

/**
 * Every Work-level requirement, in checklist order, with the wording the Publish checklist shows.
 * `realmCover` applies only while the Work's Realm is a public draft (see `realmCoverSubmitRule`);
 * the rest apply only to a Work's first publication (see `isWorkFirstPublication`).
 */
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

/** The Work fields the rule reads: its status and its own title and description. */
export type WorkPublishReadinessWork = Pick<FullWorkProject, 'status' | 'workingTitle' | 'workingDescription'>;

/** The Tale / Tune / Television section fields the rule reads: its covers and genres. */
export type WorkPublishReadinessSection = Pick<
  FullTale | FullTune | FullTelevision,
  'coverSquareAssetId' | 'coverPosterAssetId' | 'coverCinematicAssetId' | 'workGenres'
>;

/** The guildmate fields the rule reads. Every guildmate doc is passed; departed ones are ignored. */
export type WorkPublishReadinessGuildmate = Pick<
  GuildmateUser,
  'status' | 'holderType' | 'stakeShareCount' | 'tradeProfessions'
>;

/** The Realm fields the Realm-cover rule reads. */
export type WorkPublishReadinessRealm = Pick<WorkRealm, 'realmType' | 'realmStatus' | 'realmCoverAssetId'>;

export interface WorkPublishReadinessInput {
  readonly work: WorkPublishReadinessWork;
  readonly section: WorkPublishReadinessSection;
  readonly guildmates: ReadonlyArray<WorkPublishReadinessGuildmate>;
  /** The Work's Realm for the submit-time Realm-cover rule, or `null` when the Work has none, its
   *  doc is missing, or the caller is not deciding a submit (approval and publish do not apply
   *  the rule). A caller whose Realm read is still loading or failed has no answer to pass:
   *  readiness is unknown until it resolves. */
  readonly realm: WorkPublishReadinessRealm | null;
}

export interface WorkPublishRequirementCheck {
  readonly requirement: WorkPublishRequirement;
  readonly met: boolean;
}

export interface WorkPublishReadiness {
  /** True until the Work's first publication; the first-publication requirements apply only then. */
  readonly firstPublication: boolean;
  /** Every requirement that applies to this Work now, in checklist order, met or not. */
  readonly checks: ReadonlyArray<WorkPublishRequirementCheck>;
  /** The requirements in `checks` that are not met; empty means the Work is ready. */
  readonly unmet: ReadonlyArray<WorkPublishRequirement>;
  /** The stake shares the active guildmates hold, founding-Work holders included. */
  readonly totalShares: number;
  readonly ready: boolean;
}

/**
 * True until the Work is first published. The first-publication requirements — title,
 * description, covers, genres, the full share split, and every collaborator's share and trade
 * profession — are decided once, at that first publication: the split locks then, and a departed
 * member's retained shares must not block a later chapter, track, or episode.
 */
export function isWorkFirstPublication(work: Pick<FullWorkProject, 'status'>): boolean {
  return work.status !== 'published';
}

/**
 * The Realm-cover rule for a submit: a public Realm still in draft must carry its cover before
 * its Work submits content (the first publication releases the Realm). `null` when the rule does
 * not apply — no Realm, a standalone Realm, or a released one.
 */
export function realmCoverSubmitRule(realm: WorkPublishReadinessRealm | null): { readonly met: boolean } | null {
  if (realm === null || realm.realmType !== 'public' || realm.realmStatus !== 'draft') return null;
  return { met: typeof realm.realmCoverAssetId === 'string' && realm.realmCoverAssetId.length > 0 };
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAsset(assetId: string | undefined): boolean {
  return typeof assetId === 'string' && assetId.length > 0;
}

/** Decides the Work-level publish readiness. Pure: the caller reads every input itself, inside
 *  the transaction that acts on the answer when it writes. */
export function checkWorkPublishReadiness(input: WorkPublishReadinessInput): WorkPublishReadiness {
  const { work, section, guildmates, realm } = input;
  const firstPublication = isWorkFirstPublication(work);
  const active = guildmates.filter((member) => member.status === 'active');
  const totalShares = active.reduce((sum, member) => sum + (member.stakeShareCount || 0), 0);

  const checks: WorkPublishRequirementCheck[] = [];
  if (firstPublication) {
    // Founding-Work stake holders hold shares but are not people, so they have no trade
    // profession: they count toward the total and are left out of the per-person check.
    const collaborators = active.filter((member) => member.holderType !== FOUNDING_WORK_HOLDER_TYPE);
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
          (member) => (member.stakeShareCount || 0) > 0 && (member.tradeProfessions || []).length > 0,
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
