import { MIGRATION_ACTION_IDS as A } from './action-ids.js';
import type { MigrationActionId } from './action-ids.js';
import type { RegisteredCollectionPath } from '../doc-schemas/registry.js';
import { SPORT_KEYS } from '../types/sports.js';
import { MAX_MIGRATION_PAGE_SIZE, MIGRATION_COMMIT_WRITE_LIMIT } from './run-state.js';

export const MIGRATION_STEP_KIND_KEYS = [
  'executable',
  'productControl',
  'operatorCheckpoint',
  'cutoverMarker',
] as const;
export type MigrationStepKind = (typeof MIGRATION_STEP_KIND_KEYS)[number];

export const MIGRATION_RESULT_KIND_KEYS = ['write', 'verification'] as const;
export type MigrationResultKind = (typeof MIGRATION_RESULT_KIND_KEYS)[number];

export const MIGRATION_CONTROL_EVIDENCE_KEYS = ['statsOperation', 'statsValidationReport'] as const;
export type MigrationControlEvidence = (typeof MIGRATION_CONTROL_EVIDENCE_KEYS)[number];

export const MIGRATION_OWNING_STEP_KEYS = [
  'auth',
  'q-core',
  'stat-data-model',
  'high-risk-callables',
  'uploads-and-media',
  'query-and-invalidation',
  'secret-management',
  'migration-console',
] as const;
export type MigrationOwningStep = (typeof MIGRATION_OWNING_STEP_KEYS)[number];

interface MigrationStepBase {
  readonly id: MigrationActionId;
  readonly title: string;
  readonly summary: string;
  readonly owningStep: MigrationOwningStep;
  readonly dependsOn: readonly MigrationActionId[];
  readonly orderedAfter: readonly MigrationActionId[];
}

export interface ExecutableMigrationStep extends MigrationStepBase {
  readonly kind: 'executable';
  readonly callable: string;
  readonly resultKind: MigrationResultKind;
  readonly destructive: boolean;
  readonly paged: boolean;
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly informational: boolean;
  readonly idempotency: string;
  readonly resumeKey: string;
  readonly recovery: string;
  // The steps whose V1 source this destructive step removes; a non-destructive step consumes none.
  readonly consumes: readonly MigrationActionId[];
}

export interface ProductControlMigrationStep extends MigrationStepBase {
  readonly kind: 'productControl';
  readonly callable: string;
  readonly instructions: string;
  readonly evidence: MigrationControlEvidence;
  readonly destinations: readonly RegisteredCollectionPath[];
}

export interface OperatorCheckpointMigrationStep extends MigrationStepBase {
  readonly kind: 'operatorCheckpoint';
  readonly instructions: string;
  readonly evidence: string;
  readonly noReturnBoundary: string | null;
}

export interface CutoverMarkerMigrationStep extends MigrationStepBase {
  readonly kind: 'cutoverMarker';
  readonly callable: string;
  readonly noReturnBoundary: string;
}

export type MigrationStep =
  | ExecutableMigrationStep
  | ProductControlMigrationStep
  | OperatorCheckpointMigrationStep
  | CutoverMarkerMigrationStep;

export const RECORD_MIGRATION_CONTROL_RUN_CALLABLE = 'adminRecordMigrationControlRun';
export const RECORD_MIGRATION_CHECKPOINT_CALLABLE = 'adminRecordMigrationCheckpoint';
export const RECORD_MIGRATION_CUTOVER_CALLABLE = 'adminRecordMigrationCutover';
export const GET_MIGRATION_CONSOLE_CALLABLE = 'adminGetMigrationConsole';

export function migrationActionCallableName(id: MigrationActionId): string {
  const [verb = '', object = ''] = id.split('.');
  const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  return `admin${capitalize(verb)}${capitalize(object)}`;
}

const COPY_IDEMPOTENCY =
  'Deterministic destination ids written whole, so a re-run rewrites the same documents with the same content.';
const VERIFY_IDEMPOTENCY = 'Reads only; a re-run compares again.';
const DELETE_IDEMPOTENCY =
  'Deletes by id; a document already gone is skipped, so a re-run removes only what is left.';
const BY_DOCUMENT_ID =
  'Source documents in document-id order; the resume key is the last id consumed.';
const SINGLE_DOCUMENT = 'One source document; it is never paged.';
const COPY_RECOVERY = 'Fix the transform and run the copy again; it refuses a live destination.';
const VERIFY_RECOVERY =
  'Repair what it reports, through its copy or its resolution, and verify again.';
const DELETE_RECOVERY =
  'Forward repair only: the retained V1 Firestore export holds what was deleted.';
const V1_CHECK_RECOVERY = 'Fix what it reports in V1, then run the check again.';

interface ExecutableOptions {
  title: string;
  summary: string;
  owningStep: MigrationOwningStep;
  dependsOn?: readonly MigrationActionId[];
  orderedAfter?: readonly MigrationActionId[];
  resumeKey?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
}

function copyStep(id: MigrationActionId, options: ExecutableOptions): ExecutableMigrationStep {
  return {
    kind: 'executable',
    id,
    callable: migrationActionCallableName(id),
    resultKind: 'write',
    destructive: false,
    paged: true,
    defaultPageSize: options.defaultPageSize ?? 100,
    maxPageSize: options.maxPageSize ?? MAX_MIGRATION_PAGE_SIZE,
    informational: false,
    idempotency: COPY_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: COPY_RECOVERY,
    consumes: [],
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [A.checkpointV1FirestoreExport],
    orderedAfter: options.orderedAfter ?? [],
  };
}

function verifyStep(
  id: MigrationActionId,
  options: ExecutableOptions & { informational?: boolean; recovery?: string },
): ExecutableMigrationStep {
  return {
    kind: 'executable',
    id,
    callable: migrationActionCallableName(id),
    resultKind: 'verification',
    destructive: false,
    paged: true,
    defaultPageSize: options.defaultPageSize ?? 100,
    maxPageSize: options.maxPageSize ?? MAX_MIGRATION_PAGE_SIZE,
    informational: options.informational ?? false,
    idempotency: VERIFY_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: options.recovery ?? VERIFY_RECOVERY,
    consumes: [],
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [],
    orderedAfter: options.orderedAfter ?? [],
  };
}

function v1CheckStep(id: MigrationActionId, options: ExecutableOptions): ExecutableMigrationStep {
  return verifyStep(id, {
    dependsOn: [A.checkpointV1FirestoreExport],
    ...options,
    recovery: V1_CHECK_RECOVERY,
  });
}

function deleteStep(
  id: MigrationActionId,
  options: ExecutableOptions & { consumes: readonly MigrationActionId[] },
): ExecutableMigrationStep {
  return {
    kind: 'executable',
    id,
    callable: migrationActionCallableName(id),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: options.defaultPageSize ?? 100,
    maxPageSize: options.maxPageSize ?? MAX_MIGRATION_PAGE_SIZE,
    informational: false,
    idempotency: DELETE_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: DELETE_RECOVERY,
    consumes: options.consumes,
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [],
    orderedAfter: options.orderedAfter ?? [],
  };
}

const SOURCE_VERIFICATIONS_FOR_REBUILD = [
  A.verifySportLeagues,
  A.verifyLeagueTeams,
  A.verifyTeamMemberships,
  A.verifyGameRosterPlayers,
  A.verifySportGames,
  A.verifyGameStats,
] as const satisfies readonly MigrationActionId[];

const COPY_VERIFICATIONS = [
  A.verifyAdminList,
  A.verifyAppConfig,
  A.verifyLandingPageConfig,
  A.verifyStatsBeacon,
  A.verifyWaiverTemplates,
  A.verifyGameLocations,
  A.verifyUserProfiles,
  A.verifyHistoricalStats,
  A.verifyReservedDisplayNames,
  A.verifyPublicUsers,
  A.verifyAwardDefinitions,
  A.verifySportLeagues,
  A.verifyLeagueTeams,
  A.verifyTeamMemberships,
  A.verifyTeamInvitations,
  A.verifyTeamJoinRequests,
  A.verifyLeagueFreeAgents,
  A.verifySignedWaivers,
  A.verifyHardwareLoanContracts,
  A.verifySportGames,
  A.verifyGameStats,
  A.verifyGameRosterPlayers,
  A.verifyV1Pictures,
] as const satisfies readonly MigrationActionId[];

export const MIGRATION_CUTOVER_MANIFEST: readonly MigrationStep[] = [
  {
    kind: 'operatorCheckpoint',
    id: A.checkpointV1FirestoreExport,
    title: 'Keep a managed export of the V1 database',
    summary:
      'The managed Firestore export is the record of V1 and the only recovery after a delete.',
    owningStep: 'migration-console',
    dependsOn: [],
    orderedAfter: [],
    instructions:
      'In production, with V1 stopped, take a managed Firestore export of the whole database to a Cloud Storage bucket and keep it. In a rehearsal, name the production export the dev copy was imported from.',
    evidence: 'The export operation name and the bucket path it wrote to.',
    noReturnBoundary: null,
  },

  v1CheckStep(A.verifyV1DisplayNamesUnique, {
    title: 'Check no two V1 display names collide',
    summary:
      'Lists every group of V1 accounts whose display names normalize to one reservation key. The profiles are copied only once it finds none.',
    owningStep: 'migration-console',
  }),
  v1CheckStep(A.verifyV1TextFitsLimits, {
    title: 'Check every V1 text fits its V2 field',
    summary:
      'Lists every V1 text a copy carries into a capped V2 field that is over the field’s limit or that its schema would change. The copies it covers run only once it finds none.',
    owningStep: 'migration-console',
  }),
  v1CheckStep(A.verifyV1LeagueCapacity, {
    title: 'Check no V1 league is over capacity',
    summary:
      'Lists every V1 league holding more games or teams than a league may. The leagues, teams, and games are copied only once it finds none.',
    owningStep: 'migration-console',
  }),
  v1CheckStep(A.verifyV1HardwareContractIdsUnique, {
    title: 'Check no hardware contract id is in both V1 collections',
    summary:
      'Lists every contract id found in both V1 hardware collections. The contracts are copied only once it finds none.',
    owningStep: 'migration-console',
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
  }),

  copyStep(A.copyAdminList, {
    title: 'Copy the admin and referee rosters',
    summary:
      'The `landing/admin` role maps become `_systemData/adminList`, the roster every role check reads.',
    owningStep: 'auth',
    resumeKey: SINGLE_DOCUMENT,
  }),
  verifyStep(A.verifyAdminList, {
    title: 'Verify the rosters',
    summary: 'Every V1 admin and referee is on the copied roster, and nobody else is.',
    owningStep: 'auth',
    dependsOn: [A.copyAdminList],
    resumeKey: SINGLE_DOCUMENT,
  }),

  copyStep(A.copyAppConfig, {
    title: 'Copy the app configuration',
    summary:
      'The version and the banner from `landing/base` become `_appConfig/app`, its switches at their open defaults.',
    owningStep: 'q-core',
    dependsOn: [A.verifyV1TextFitsLimits],
    resumeKey: SINGLE_DOCUMENT,
  }),
  copyStep(A.copyLandingPageConfig, {
    title: 'Copy the landing page copy',
    summary:
      'The hero title and the about text become `_appConfig/landingPage`; its picture arrives with the picture carry.',
    owningStep: 'q-core',
    dependsOn: [A.verifyV1TextFitsLimits],
    resumeKey: SINGLE_DOCUMENT,
  }),
  copyStep(A.copyStatsBeacon, {
    title: 'Copy the stats beacon',
    summary:
      'The last stats change V1 announced becomes `_appConfig/statsBeacon`, or nothing when V1 never fired one.',
    owningStep: 'query-and-invalidation',
    resumeKey: SINGLE_DOCUMENT,
  }),
  verifyStep(A.verifyAppConfig, {
    title: 'Verify the app configuration',
    summary:
      'The version and the banner match V1 before the cutover, and the document satisfies its schema after it.',
    owningStep: 'q-core',
    dependsOn: [A.copyAppConfig],
    resumeKey: SINGLE_DOCUMENT,
  }),
  verifyStep(A.verifyLandingPageConfig, {
    title: 'Verify the landing page copy',
    summary: 'The landing copy matches V1 before the cutover, and satisfies its schema after it.',
    owningStep: 'q-core',
    dependsOn: [A.copyLandingPageConfig],
    resumeKey: SINGLE_DOCUMENT,
  }),
  verifyStep(A.verifyStatsBeacon, {
    title: 'Verify the stats beacon',
    summary: 'A beacon at least as recent as V1’s exists, or V1 never fired one.',
    owningStep: 'query-and-invalidation',
    dependsOn: [A.copyStatsBeacon],
    resumeKey: SINGLE_DOCUMENT,
  }),

  copyStep(A.copyWaiverTemplates, {
    title: 'Copy the waiver templates',
    summary: 'Each template under its id, its wording as version 1.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyV1TextFitsLimits],
    maxPageSize: 200,
  }),
  verifyStep(A.verifyWaiverTemplates, {
    title: 'Verify the waiver templates',
    summary: 'Every V1 template copied with its first version.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyWaiverTemplates],
  }),
  copyStep(A.copyGameLocations, {
    title: 'Copy the game locations',
    summary:
      'Each venue on `landing/admin` becomes a `gameLocations` document under its id; its picture arrives with the picture carry.',
    owningStep: 'q-core',
    dependsOn: [A.verifyV1TextFitsLimits],
    resumeKey: 'The venues in array order; the resume key is the last venue id.',
  }),
  verifyStep(A.verifyGameLocations, {
    title: 'Verify the game locations',
    summary: 'Every V1 venue copied and equal.',
    owningStep: 'q-core',
    dependsOn: [A.copyGameLocations],
    resumeKey: 'The venues in array order; the resume key is the last venue id.',
  }),

  copyStep(A.copyUserProfiles, {
    title: 'Copy the profiles',
    summary:
      'Each `users` document becomes its profile and its owner-only private document, every account active.',
    owningStep: 'auth',
    dependsOn: [A.verifyV1DisplayNamesUnique, A.verifyV1TextFitsLimits],
    maxPageSize: Math.floor(MIGRATION_COMMIT_WRITE_LIMIT / 2),
  }),
  verifyStep(A.verifyUserProfiles, {
    title: 'Verify the profiles',
    summary: 'Every V1 profile copied with its private document.',
    owningStep: 'auth',
    dependsOn: [A.copyUserProfiles],
  }),
  {
    kind: 'operatorCheckpoint',
    id: A.checkpointAbandonedRegistrationSweepEnabled,
    title: 'Enable the abandoned-registration sweep',
    summary:
      'The scheduled sweep that deletes a sign-in account still holding no profile after its grace window does nothing until this is recorded, and stops again whenever the profile verification is run anew.',
    owningStep: 'auth',
    dependsOn: [A.verifyUserProfiles],
    orderedAfter: [],
    instructions:
      'Once the profile verification has passed, confirm every account that should keep its sign-in holds a copied profile, then record this step to let the scheduled sweep delete the sign-in accounts that hold none past their grace window.',
    evidence:
      'The passing profile verification this step follows, and the count of profiles it checked.',
    noReturnBoundary: 'The sweep’s first deletion of a sign-in account that holds no profile.',
  },
  copyStep(A.copyHistoricalStats, {
    title: 'Copy the historical baselines',
    summary: 'Each pre-Q-Sports career total becomes its sport’s `historicalStats` document.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copyUserProfiles],
    maxPageSize: Math.floor(MIGRATION_COMMIT_WRITE_LIMIT / SPORT_KEYS.length),
  }),
  verifyStep(A.verifyHistoricalStats, {
    title: 'Verify the historical baselines',
    summary: 'Every V1 baseline copied and equal; a database with none is declared empty.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copyHistoricalStats],
  }),
  copyStep(A.deriveReservedDisplayNames, {
    title: 'Reserve the display names',
    summary: 'One reservation per copied profile.',
    owningStep: 'auth',
    dependsOn: [A.copyUserProfiles, A.verifyV1DisplayNamesUnique],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyReservedDisplayNames, {
    title: 'Verify the display-name reservations',
    summary: 'Every profile holds the reservation of its name.',
    owningStep: 'auth',
    dependsOn: [A.deriveReservedDisplayNames],
  }),
  copyStep(A.migratePublicUsers, {
    title: 'Migrate the public identities in place',
    summary:
      'Each `publicUsers` document is rewritten where it sits: epoch timestamps, the recomputed lowercase name, the ghost flag.',
    owningStep: 'q-core',
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyPublicUsers, {
    title: 'Verify the public identities',
    summary:
      'Each document holds its own uid, ghost flag, and lowercase name, and shows the featured badges its profile holds.',
    owningStep: 'q-core',
    dependsOn: [A.migratePublicUsers, A.copyUserProfiles],
  }),
  copyStep(A.copyAwardDefinitions, {
    title: 'Copy the award catalog',
    summary:
      'Each award on `landing/admin` becomes an `awardDefinitions` document with its holder count; its badge arrives with the picture carry.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.copyUserProfiles, A.verifyV1TextFitsLimits],
    resumeKey: 'The awards in array order; the resume key is the last award id.',
  }),
  verifyStep(A.verifyAwardDefinitions, {
    title: 'Verify the award catalog',
    summary:
      'Every award copied, every holder count equal to the profiles holding it, every grant, profile award pick, and shown badge naming an award that exists.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.copyAwardDefinitions, A.migratePublicUsers],
    resumeKey: SINGLE_DOCUMENT,
  }),

  copyStep(A.copySportLeagues, {
    title: 'Copy the leagues',
    summary:
      'Each league under its id — closed leagues included; its pictures arrive with the picture carry.',
    owningStep: 'q-core',
    dependsOn: [A.verifyV1LeagueCapacity, A.verifyV1TextFitsLimits],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifySportLeagues, {
    title: 'Verify the leagues',
    summary: 'Every V1 league copied and equal, every waiver template it names existing.',
    owningStep: 'q-core',
    dependsOn: [A.copySportLeagues, A.copyWaiverTemplates],
  }),
  copyStep(A.copyLeagueTeams, {
    title: 'Copy the teams',
    summary: 'Each team under its id, its season lines in its sport’s shape.',
    owningStep: 'q-core',
    dependsOn: [A.verifyV1LeagueCapacity, A.verifyV1TextFitsLimits],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyLeagueTeams, {
    title: 'Verify the teams',
    summary:
      'Every V1 team copied; the season lines are held to their schema, since the rebuild replaces them.',
    owningStep: 'q-core',
    dependsOn: [A.copyLeagueTeams],
  }),
  copyStep(A.copyTeamMemberships, {
    title: 'Copy the memberships',
    summary:
      'Each membership under its compound id, `member` becoming `player`; one whose team was not copied into its league is left behind and reported.',
    owningStep: 'q-core',
    dependsOn: [A.copyLeagueTeams],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyTeamMemberships, {
    title: 'Verify the memberships',
    summary:
      'Every V1 membership copied, or absent because its team is gone; a team with two captains and a ghost on two memberships are reported.',
    owningStep: 'q-core',
    dependsOn: [A.copyTeamMemberships],
  }),
  copyStep(A.copyTeamInvitations, {
    title: 'Copy the invitations',
    summary:
      'Each invitation by id; a pending one whose invitee is already on the team is written approved, and a pending one whose team was not copied into its league is left behind and reported.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyLeagueTeams, A.copyTeamMemberships, A.verifyV1TextFitsLimits],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyTeamInvitations, {
    title: 'Verify the invitations',
    summary:
      'Every V1 invitation copied as the transform makes it, or absent because its team is gone.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyTeamInvitations],
  }),
  copyStep(A.copyTeamJoinRequests, {
    title: 'Copy the join requests',
    summary:
      'Each request by id; a pending one whose requester is already on the team is written approved, and a pending one whose team was not copied into its league is left behind and reported.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyLeagueTeams, A.copyTeamMemberships, A.verifyV1TextFitsLimits],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyTeamJoinRequests, {
    title: 'Verify the join requests',
    summary:
      'Every V1 request copied as the transform makes it, or absent because its team is gone.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyTeamJoinRequests],
  }),
  copyStep(A.copyLeagueFreeAgents, {
    title: 'Copy the free-agent signups',
    summary:
      'Each signup under its built id; a signup whose player already joined a team in the league is left behind and reported.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyTeamMemberships],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyLeagueFreeAgents, {
    title: 'Verify the free-agent signups',
    summary: 'Every V1 signup copied, or absent because joining left it behind.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyLeagueFreeAgents],
  }),

  copyStep(A.copySignedWaivers, {
    title: 'Copy the signed waivers',
    summary:
      'Every signed waiver, a ghost’s included, under its id; its signature file stays where it is.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.copyWaiverTemplates],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifySignedWaivers, {
    title: 'Verify the signed waivers',
    summary: 'Every V1 record copied and equal, each template it names existing.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.copySignedWaivers],
  }),
  copyStep(A.copyHardwareLoanContracts, {
    title: 'Copy the hardware loan contracts',
    summary:
      'Each contract from both V1 collections under its id; its signature file stays where it is.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyV1HardwareContractIdsUnique],
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
  }),
  verifyStep(A.verifyHardwareLoanContracts, {
    title: 'Verify the hardware loan contracts',
    summary: 'Every V1 contract copied and equal.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyHardwareLoanContracts],
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
  }),
  verifyStep(A.verifySignatureFilesResolvable, {
    title: 'Verify the signature files resolve',
    summary:
      'Each kept signature file is in this project’s bucket and exists. A rehearsal reports every file as another environment’s, which is expected.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.verifySignedWaivers, A.verifyHardwareLoanContracts],
    resumeKey: 'The signed waivers by id, then the contracts; the resume key is the record path.',
  }),

  copyStep(A.copyGameRosterPlayers, {
    title: 'Copy the game rosters',
    summary:
      'One entry per team per person in each game, from each V1 roster document’s own team and user.',
    owningStep: 'high-risk-callables',
    resumeKey: 'The V1 games by document id; the resume key is the last game id.',
    defaultPageSize: 50,
    maxPageSize: 50,
  }),
  {
    kind: 'executable',
    id: A.resolveUnrosteredStatLine,
    callable: migrationActionCallableName(A.resolveUnrosteredStatLine),
    resultKind: 'write',
    destructive: false,
    paged: false,
    defaultPageSize: 1,
    maxPageSize: MAX_MIGRATION_PAGE_SIZE,
    informational: false,
    idempotency: 'A second resolution of the same line is acknowledged and writes nothing.',
    resumeKey: 'One game, one line; it is never paged.',
    recovery: 'Resolve the line again with the right team, then copy the game again.',
    consumes: [],
    title: 'Resolve a stat line no roster places',
    summary:
      'For a line the game copy stops on, the admin names its team: the missing roster entry is written with its reason, and the game copied again.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copyGameRosterPlayers],
    orderedAfter: [],
  },
  copyStep(A.copySportGames, {
    title: 'Copy the games',
    summary:
      'Each V1 game with its stats: the event documents, the rollup, the participation lists by roster entry, and a completed game’s finalized record.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copyGameRosterPlayers, A.verifyV1LeagueCapacity, A.verifyV1TextFitsLimits],
    orderedAfter: [A.resolveUnrosteredStatLine],
    resumeKey:
      'The V1 games by document id; a game’s documents commit before its id becomes the resume key.',
    defaultPageSize: 20,
    maxPageSize: 25,
  }),
  verifyStep(A.verifySportGames, {
    title: 'Verify the game schedules',
    summary: 'Every V1 game’s schedule fields as the copy converts them.',
    owningStep: 'q-core',
    dependsOn: [A.copySportGames],
  }),
  verifyStep(A.verifyGameStats, {
    title: 'Verify the game stats',
    summary:
      'Per game: the events replay to the rollup and to V1’s recorded lines, the finalized record matches, and every line and list names a roster entry.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copySportGames],
    defaultPageSize: 20,
    maxPageSize: 25,
  }),
  {
    kind: 'executable',
    id: A.reconcileOpenGameRosters,
    callable: migrationActionCallableName(A.reconcileOpenGameRosters),
    resultKind: 'write',
    destructive: false,
    paged: true,
    defaultPageSize: 20,
    maxPageSize: 25,
    informational: false,
    idempotency:
      'Each open game is reconciled through the roster core against the copied memberships; a reconciled game changes nothing on a re-run.',
    resumeKey: 'The open games by document id; the resume key is the last game id.',
    recovery:
      'Run it again: a game held by another operation is reported and reconciled on the next run.',
    consumes: [],
    title: 'Reconcile the open games’ rosters',
    summary:
      'Each game open at the cutover: stale stat-free entries removed, missing members added.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyTeamMemberships, A.verifyGameStats],
    orderedAfter: [],
  },
  verifyStep(A.verifyGameRosterPlayers, {
    title: 'Verify the game rosters',
    summary: 'Every V1 roster entry copied; before the cutover, no open game keeps a stale entry.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyGameRosterPlayers, A.reconcileOpenGameRosters],
    resumeKey: 'The V1 games by document id; the resume key is the last game id.',
  }),

  copyStep(A.carryV1Pictures, {
    title: 'Carry the V1 pictures onto the pipeline',
    summary:
      'Each league, landing, venue, and award image is staged and accepted through the upload pipeline, which processes and publishes it. A rehearsal reports every source unavailable.',
    owningStep: 'uploads-and-media',
    dependsOn: [
      A.copySportLeagues,
      A.copyLandingPageConfig,
      A.copyGameLocations,
      A.copyAwardDefinitions,
    ],
    resumeKey: 'By owner kind, then owner id; the resume key is `{ownerKind}:{ownerId}`.',
  }),
  verifyStep(A.verifyV1Pictures, {
    title: 'Verify the carried pictures',
    summary:
      'Every V1 reference attached with its three sizes, or reported for a reason no re-run changes; nothing still pending. A source in another bucket, or a page it could examine none of, fails it unless the run acknowledges unexamined sources, as a rehearsal does.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.carryV1Pictures],
    resumeKey: 'By owner kind, then owner id; the resume key is `{ownerKind}:{ownerId}`.',
  }),

  {
    kind: 'executable',
    id: A.cleanupOrphanGhostPublicUsers,
    callable: migrationActionCallableName(A.cleanupOrphanGhostPublicUsers),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: 100,
    maxPageSize: 100,
    informational: false,
    idempotency:
      'A ghost document is deleted only when nothing references it; a re-run finds nothing further.',
    resumeKey: BY_DOCUMENT_ID,
    recovery: DELETE_RECOVERY,
    consumes: [],
    title: 'Remove the ghost names nothing references',
    summary:
      'Each ghost `publicUsers` document no membership, roster entry, or unvoided stat event names, reported by disposition first. No signed waiver is touched.',
    owningStep: 'high-risk-callables',
    dependsOn: [
      A.verifyPublicUsers,
      A.verifyTeamMemberships,
      A.verifyGameRosterPlayers,
      A.verifyGameStats,
    ],
    orderedAfter: [],
  },

  {
    kind: 'productControl',
    id: A.rebuildLeagueStats,
    title: 'Rebuild every league’s stats',
    summary:
      'Every team’s season line and per-membership rows, closed leagues included, rebuilt from the copied games.',
    owningStep: 'stat-data-model',
    dependsOn: SOURCE_VERIFICATIONS_FOR_REBUILD,
    orderedAfter: [],
    callable: 'recalculateAllLeagueStats',
    destinations: ['leagueTeams/{teamId}'],
    instructions:
      'Run “Rebuild every league” from Stats › Fix stats as a real run, not a dry run, and let it reach the end.',
    evidence: 'statsOperation',
  },
  {
    kind: 'productControl',
    id: A.rebuildLifetimeStats,
    title: 'Rebuild every user’s lifetime stats',
    summary:
      'Every account’s lifetime lines rebuilt from the copied games and historical baselines.',
    owningStep: 'stat-data-model',
    dependsOn: [A.rebuildLeagueStats, A.verifyUserProfiles, A.verifyHistoricalStats],
    orderedAfter: [],
    callable: 'recalculateAllUserStats',
    destinations: ['userProfiles/{userId}'],
    instructions:
      'Run “Rebuild every user” from Stats › Fix stats as a real run, and let it reach the end.',
    evidence: 'statsOperation',
  },
  {
    kind: 'productControl',
    id: A.rebuildSportHallOfFame,
    title: 'Rebuild the hall of fame',
    summary:
      'The hall of fame of every sport that keeps one, rebuilt from the copied games and baselines.',
    owningStep: 'stat-data-model',
    dependsOn: [A.rebuildLifetimeStats],
    orderedAfter: [],
    callable: 'recalculateHallOfFame',
    destinations: ['sportHallOfFame/{sportKey}'],
    instructions:
      'Run the hall-of-fame rebuild from Stats › Fix stats once for each sport that keeps a hall of fame, as real runs, and record every run.',
    evidence: 'statsOperation',
  },
  {
    kind: 'productControl',
    id: A.validateStats,
    title: 'Validate the stats',
    summary: 'Check stats over everything; it must report no finding.',
    owningStep: 'stat-data-model',
    dependsOn: [A.rebuildSportHallOfFame],
    orderedAfter: [],
    callable: 'runStatsValidation',
    destinations: ['statsValidationReports/{reportId}'],
    instructions: 'Run “Check stats” over everything from Stats › Fix stats and let it finish.',
    evidence: 'statsValidationReport',
  },
  verifyStep(A.verifyLeaguePlayerStats, {
    title: 'Compare the league player totals with V1',
    summary:
      'Lists each player whose V1 league total differs from the sum of their rebuilt rows in that league. It informs the rehearsal and gates nothing.',
    owningStep: 'stat-data-model',
    dependsOn: [A.rebuildLeagueStats],
    informational: true,
  }),
  verifyStep(A.verifySportHallOfFame, {
    title: 'Verify the rebuilt hall of fame',
    summary:
      'Every V1 hall of fame of a sport that keeps one has its rebuilt document, which satisfies its schema and holds an entry for every V1 player with a non-zero total.',
    owningStep: 'stat-data-model',
    dependsOn: [A.rebuildSportHallOfFame],
  }),

  {
    kind: 'cutoverMarker',
    id: A.recordCutoverLive,
    callable: RECORD_MIGRATION_CUTOVER_CALLABLE,
    title: 'Record the cutover',
    summary:
      'From here on the product owns every destination: no copy runs again, and each verification holds what the product edits to its schema only.',
    owningStep: 'migration-console',
    dependsOn: [...COPY_VERIFICATIONS, A.validateStats],
    orderedAfter: [A.verifySportHallOfFame, A.verifySignatureFilesResolvable],
    noReturnBoundary:
      'Recording the cutover. It is never undone: every copy refuses a live destination after it.',
  },

  deleteStep(A.deleteV1LandingBase, {
    title: 'Delete `landing/base`',
    summary:
      'The V1 configuration document, once its three documents and its picture are verified.',
    owningStep: 'q-core',
    dependsOn: [
      A.verifyAppConfig,
      A.verifyLandingPageConfig,
      A.verifyStatsBeacon,
      A.verifyV1Pictures,
    ],
    resumeKey: SINGLE_DOCUMENT,
    consumes: [
      A.copyAppConfig,
      A.copyLandingPageConfig,
      A.copyStatsBeacon,
      A.verifyAppConfig,
      A.verifyLandingPageConfig,
      A.verifyStatsBeacon,
      A.carryV1Pictures,
      A.verifyV1Pictures,
      A.verifyV1TextFitsLimits,
    ],
  }),
  deleteStep(A.deleteV1LandingAdmin, {
    title: 'Delete `landing/admin`',
    summary:
      'The V1 admin document — its role maps, venues and award catalog — once the rosters, the venues, the awards and their pictures are verified.',
    owningStep: 'q-core',
    dependsOn: [
      A.verifyAdminList,
      A.verifyGameLocations,
      A.verifyAwardDefinitions,
      A.verifyUserProfiles,
      A.verifyPublicUsers,
      A.verifyV1Pictures,
    ],
    resumeKey: SINGLE_DOCUMENT,
    consumes: [
      A.copyAdminList,
      A.verifyAdminList,
      A.copyGameLocations,
      A.verifyGameLocations,
      A.copyAwardDefinitions,
      A.verifyAwardDefinitions,
      A.carryV1Pictures,
      A.verifyV1Pictures,
      A.verifyV1TextFitsLimits,
    ],
  }),
  deleteStep(A.deleteV1Waivers, {
    title: 'Delete the V1 waiver templates',
    summary: 'The `waivers` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyWaiverTemplates],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copyWaiverTemplates, A.verifyWaiverTemplates, A.verifyV1TextFitsLimits],
  }),
  deleteStep(A.deleteV1Users, {
    title: 'Delete the V1 user documents',
    summary: 'Each `users` document with its historical baselines.',
    owningStep: 'auth',
    dependsOn: [A.verifyUserProfiles, A.verifyHistoricalStats, A.verifyReservedDisplayNames],
    maxPageSize: 200,
    consumes: [
      A.copyUserProfiles,
      A.verifyUserProfiles,
      A.copyHistoricalStats,
      A.verifyHistoricalStats,
      A.migratePublicUsers,
      A.verifyPublicUsers,
      A.verifyV1DisplayNamesUnique,
      A.verifyV1TextFitsLimits,
    ],
  }),
  deleteStep(A.deleteV1TeamInvites, {
    title: 'Delete the V1 invitations',
    summary: 'The `teamInvites` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyTeamInvitations],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copyTeamInvitations, A.verifyTeamInvitations, A.verifyV1TextFitsLimits],
  }),
  deleteStep(A.deleteV1JoinRequests, {
    title: 'Delete the V1 join requests',
    summary: 'The `joinRequests` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyTeamJoinRequests],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copyTeamJoinRequests, A.verifyTeamJoinRequests, A.verifyV1TextFitsLimits],
  }),
  deleteStep(A.deleteV1FreeAgentSignups, {
    title: 'Delete the V1 free-agent signups',
    summary: 'The `freeAgentSignups` collection, left-behind signups included.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyLeagueFreeAgents],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copyLeagueFreeAgents, A.verifyLeagueFreeAgents],
  }),
  deleteStep(A.deleteV1TeamMembers, {
    title: 'Delete the V1 memberships',
    summary: 'The `teamMembers` collection.',
    owningStep: 'q-core',
    dependsOn: [A.verifyTeamMemberships],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copyTeamMemberships, A.verifyTeamMemberships],
  }),
  deleteStep(A.deleteV1Teams, {
    title: 'Delete the V1 teams',
    summary: 'The `teams` collection; a team still holding a subcollection is reported and kept.',
    owningStep: 'q-core',
    dependsOn: [A.verifyLeagueTeams],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [
      A.copyLeagueTeams,
      A.verifyLeagueTeams,
      A.verifyV1LeagueCapacity,
      A.verifyV1TextFitsLimits,
    ],
  }),
  {
    kind: 'executable',
    id: A.revokeV1SignatureDownloadTokens,
    callable: migrationActionCallableName(A.revokeV1SignatureDownloadTokens),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: 100,
    maxPageSize: 200,
    informational: false,
    idempotency:
      'Removes a kept file’s download token; a file holding none is skipped. No file is moved or deleted.',
    resumeKey: 'The signed waivers by id, then the contracts; the resume key is the record path.',
    recovery: 'Run it again; a file whose token went is skipped.',
    consumes: [],
    title: 'Revoke the V1 signature download links',
    summary:
      'Each kept signature file loses the download token V1’s stored links carry, so those links stop resolving.',
    owningStep: 'uploads-and-media',
    dependsOn: [
      A.verifySignedWaivers,
      A.verifyHardwareLoanContracts,
      A.verifySignatureFilesResolvable,
    ],
    orderedAfter: [],
  },
  deleteStep(A.deleteV1WaiverSignatures, {
    title: 'Delete the V1 signed-waiver records',
    summary: 'The `waiverSignatures` records; the files stay, named by the copied records.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.verifySignedWaivers],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.copySignedWaivers, A.verifySignedWaivers],
  }),
  deleteStep(A.deleteV1HardwareContracts, {
    title: 'Delete the V1 hardware contracts',
    summary:
      'Both V1 contract collections; the signature files stay, named by the copied contracts.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyHardwareLoanContracts],
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [
      A.copyHardwareLoanContracts,
      A.verifyHardwareLoanContracts,
      A.verifyV1HardwareContractIdsUnique,
    ],
  }),
  deleteStep(A.deleteV1GameRosters, {
    title: 'Delete the V1 game rosters',
    summary: 'Each V1 game’s `roster` subcollection — never the game document.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyGameRosterPlayers, A.validateStats],
    resumeKey: 'The V1 games by document id; the resume key is the last game id.',
    defaultPageSize: 50,
    maxPageSize: 50,
    consumes: [
      A.copyGameRosterPlayers,
      A.verifyGameRosterPlayers,
      A.copySportGames,
      A.verifySportGames,
      A.verifyGameStats,
    ],
  }),
  deleteStep(A.deleteV1LeagueGames, {
    title: 'Delete the V1 games',
    summary: 'The `leagueGames` documents; a game still holding its roster is reported and kept.',
    owningStep: 'stat-data-model',
    dependsOn: [
      A.verifySportGames,
      A.verifyGameStats,
      A.verifyGameRosterPlayers,
      A.validateStats,
      A.deleteV1GameRosters,
    ],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [
      A.copySportGames,
      A.verifySportGames,
      A.verifyGameStats,
      A.copyGameRosterPlayers,
      A.verifyGameRosterPlayers,
      A.verifyV1LeagueCapacity,
      A.verifyV1TextFitsLimits,
    ],
  }),
  deleteStep(A.deleteV1LeagueChats, {
    title: 'Delete the V1 league chats',
    summary:
      'The parked chat documents under each V1 league and its team paths. Any other document found under a league is reported and kept.',
    owningStep: 'migration-console',
    dependsOn: [A.checkpointV1FirestoreExport],
    resumeKey:
      'The V1 leagues by document id; the resume key is the last league id, or, while a league holds more chat than one page examines or deletes, `{leagueId}/unfinished` inside its own chat and `{leagueId}/unfinished/{teamParentId}` from that team path on.',
    defaultPageSize: 50,
    maxPageSize: 50,
    consumes: [],
  }),
  deleteStep(A.deleteV1Leagues, {
    title: 'Delete the V1 leagues',
    summary:
      'The `leagues` collection; a league still holding a subcollection is reported and kept.',
    owningStep: 'q-core',
    dependsOn: [A.verifySportLeagues, A.verifyV1Pictures],
    orderedAfter: [A.verifyLeaguePlayerStats, A.deleteV1LeagueChats],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [
      A.copySportLeagues,
      A.verifySportLeagues,
      A.verifyLeaguePlayerStats,
      A.carryV1Pictures,
      A.verifyV1Pictures,
      A.verifyV1LeagueCapacity,
      A.verifyV1TextFitsLimits,
    ],
  }),
  deleteStep(A.deleteV1HallOfFame, {
    title: 'Delete the V1 hall of fame',
    summary:
      'The `hallOfFame` collection, once every sport that keeps a hall of fame has its rebuilt document.',
    owningStep: 'stat-data-model',
    dependsOn: [A.verifySportHallOfFame],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.verifySportHallOfFame],
  }),
  deleteStep(A.deleteV1ValidationReports, {
    title: 'Delete the V1 validation reports',
    summary:
      'The `validationReports` collection. Nothing is copied: each report describes V1 aggregates at a past moment.',
    owningStep: 'stat-data-model',
    dependsOn: [A.checkpointV1FirestoreExport],
    orderedAfter: [A.validateStats],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [],
  }),
  deleteStep(A.deleteV1AdminStats, {
    title: 'Delete the V1 dashboard counts',
    summary:
      'The `adminStats` collection. Nothing is copied: the dashboard counts are counted live.',
    owningStep: 'q-core',
    dependsOn: [A.checkpointV1FirestoreExport],
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [],
  }),
  verifyStep(A.verifyV1CommerceDiscardable, {
    title: 'Check the V1 store holds no purchase',
    summary:
      'Fails on an order that is not cancelled, a completed checkout, or a product holding inventory — any would be a real purchase, and goes to the owner.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.checkpointV1FirestoreExport],
    resumeKey: 'The six store collections in turn, each by document id.',
  }),
  deleteStep(A.deleteV1Commerce, {
    title: 'Delete the V1 store and payments',
    summary: 'The six store collections, nothing copied.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyV1CommerceDiscardable],
    resumeKey: 'The six store collections in turn, each by document id.',
    maxPageSize: MIGRATION_COMMIT_WRITE_LIMIT,
    consumes: [A.verifyV1CommerceDiscardable],
  }),

  {
    kind: 'operatorCheckpoint',
    id: A.checkpointUnattachedPicturesReuploaded,
    title: 'Re-upload the pictures the carry could not attach',
    summary: 'Any V1 image still unattached in production goes back on through its own control.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.verifyV1Pictures, A.recordCutoverLive],
    orderedAfter: [],
    instructions:
      'For each source the picture verification reported, re-upload the image through its control — Reupload badge for an award, the picture managers for a league, the landing page, or a venue. In a rehearsal, record that this is production-only.',
    evidence: 'Each re-uploaded owner, or that the verification reported none.',
    noReturnBoundary: null,
  },
  {
    kind: 'operatorCheckpoint',
    id: A.checkpointPaymentCredentialsRetired,
    title: 'Retire the payment-service credentials',
    summary:
      'V2 binds no payment-service credential, so once it is live the three V1 binds are live credentials with no reader.',
    owningStep: 'secret-management',
    dependsOn: [A.recordCutoverLive],
    orderedAfter: [],
    instructions:
      'Production only, once V2 is live there: revoke the payment service’s secret key and disable its webhook endpoint in its dashboard, then destroy the three secrets V1 binds for it — its secret key, its webhook secret, and APP_URL — in Secret Manager in both Firebase projects. In a rehearsal, record that this is production-only.',
    evidence:
      'The payment dashboard showing the key revoked and the endpoint disabled, and `gcloud secrets list` in each project showing none of the three.',
    noReturnBoundary: 'The secret key revocation.',
  },
  {
    kind: 'operatorCheckpoint',
    id: A.checkpointServiceAccountKeyRevoked,
    title: 'Revoke the obsolete production service-account key',
    summary:
      'No script reads the local production key once the export script runs on the signed-in CLI credentials; revoking it makes every copy of it worthless.',
    owningStep: 'secret-management',
    dependsOn: [A.checkpointV1FirestoreExport],
    orderedAfter: [A.recordCutoverLive],
    instructions:
      'Run the export script on Application Default Credentials against the production project named explicitly, then revoke the q-sports-prod service-account key in the Google Cloud console and delete serviceAccount.json from the machine. No replacement key is minted. In a rehearsal, record that this is production-only.',
    evidence: 'The export run on ADC, and the console showing the key revoked.',
    noReturnBoundary: 'The key revocation.',
  },
];

export const MIGRATION_STEP_BY_ID: ReadonlyMap<MigrationActionId, MigrationStep> = new Map(
  MIGRATION_CUTOVER_MANIFEST.map((step) => [step.id, step]),
);

export function migrationStepsOfKind<K extends MigrationStepKind>(
  kind: K,
): Extract<MigrationStep, { kind: K }>[] {
  return MIGRATION_CUTOVER_MANIFEST.filter(
    (step): step is Extract<MigrationStep, { kind: K }> => step.kind === kind,
  );
}
