// The 2.0 cutover manifest: every step of the coordinated migration, in the order the operator runs
// them, with what each step needs first. The console's callables enforce it — an action whose
// dependencies are not satisfied refuses to run — and its screen renders it, so both read this one
// declaration (RULE-STD-ARCH-101, RULE-STD-ENG-002).
//
// Four kinds of step:
//   executable          a console action with its own admin callable: admin-asserted, audited,
//                       idempotent, resumable by its operation id, and re-runnable after a partial
//                       failure. A write action offers a dry run; a verification only reads.
//   productControl      a product callable the operator runs from its own screen (the Fix stats
//                       actions and the stats check). The console never runs
//                       a second copy of it; it records the run, checking the run's own evidence.
//   operatorCheckpoint  external work the app cannot do safely — an export, a credential
//                       revocation, a manual re-upload. Recorded with the operator's evidence; it
//                       never claims the console performed it.
//   cutoverMarker       the console's own record that the product now owns every destination.
//
// `dependsOn` is enforced: each id must be satisfied — an executable action's last real run reached
// its end (a verification's also passed), and a recorded step recorded — before the step runs.
// `orderedAfter` is display order only: a sequence that is ordering, not a gate.

import { MIGRATION_ACTION_IDS as A } from './action-ids.js';
import type { MigrationActionId } from './action-ids.js';
import type { RegisteredCollectionPath } from '../doc-schemas/registry.js';

export const MIGRATION_STEP_KIND_KEYS = [
  'executable',
  'productControl',
  'operatorCheckpoint',
  'cutoverMarker',
] as const;
export type MigrationStepKind = (typeof MIGRATION_STEP_KIND_KEYS)[number];

/** What an executable action's pages return: documents written, or records compared. */
export const MIGRATION_RESULT_KIND_KEYS = ['write', 'verification'] as const;
export type MigrationResultKind = (typeof MIGRATION_RESULT_KIND_KEYS)[number];

/** Where a product control's completion is proven from. */
export const MIGRATION_CONTROL_EVIDENCE_KEYS = [
  // The control's `statsOperations` document: a real run, complete, over the whole scope, that
  // left no game out.
  'statsOperation',
  // The validation's report: complete, over everything, with no finding.
  'statsValidationReport',
] as const;
export type MigrationControlEvidence = (typeof MIGRATION_CONTROL_EVIDENCE_KEYS)[number];

/** The step folder under the migration plan that owns a step's correctness. */
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
  /** What the step changes or proves, in a sentence or two the operator reads before running it. */
  readonly summary: string;
  readonly owningStep: MigrationOwningStep;
  readonly dependsOn: readonly MigrationActionId[];
  readonly orderedAfter: readonly MigrationActionId[];
}

export interface ExecutableMigrationStep extends MigrationStepBase {
  readonly kind: 'executable';
  /** The callable that runs one page of it. */
  readonly callable: string;
  readonly resultKind: MigrationResultKind;
  /** Whether it removes V1 data or revokes access — run only once its gates have passed. */
  readonly destructive: boolean;
  /** False for an action that is one bounded call, never paged. */
  readonly paged: boolean;
  /** The page size the console proposes; each core refuses a page larger than it can commit. */
  readonly defaultPageSize: number;
  /** A verification that informs the rehearsal and gates nothing. */
  readonly informational: boolean;
  /** Why replaying a page, or the whole action, cannot duplicate an effect. */
  readonly idempotency: string;
  /** The deterministic order it pages in, and what its resume key names. */
  readonly resumeKey: string;
  /** The safe response after a partial run. */
  readonly recovery: string;
}

export interface ProductControlMigrationStep extends MigrationStepBase {
  readonly kind: 'productControl';
  /** The product callable the operator runs. */
  readonly callable: string;
  /** Where in the product the operator runs it, and with what scope. */
  readonly instructions: string;
  readonly evidence: MigrationControlEvidence;
  /** The documents it rebuilds, as `COLLECTION_SCHEMAS` templates: a destination no copy writes. */
  readonly destinations: readonly RegisteredCollectionPath[];
}

export interface OperatorCheckpointMigrationStep extends MigrationStepBase {
  readonly kind: 'operatorCheckpoint';
  readonly instructions: string;
  /** What the operator records as proof before the next step unlocks. */
  readonly evidence: string;
  /** The point past which the external action cannot be undone, or null when none exists. */
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

/** The callable that records a product control's run, checking its evidence. */
export const RECORD_MIGRATION_CONTROL_RUN_CALLABLE = 'adminRecordMigrationControlRun';
/** The callable that records an operator checkpoint with its evidence. */
export const RECORD_MIGRATION_CHECKPOINT_CALLABLE = 'adminRecordMigrationCheckpoint';
/** The callable that records the cutover. */
export const RECORD_MIGRATION_CUTOVER_CALLABLE = 'adminRecordMigrationCutover';
/** The callable that reads the console: the cutover marker, the lock, and every step's state. */
export const GET_MIGRATION_CONSOLE_CALLABLE = 'adminGetMigrationConsole';

/** The console's callable name for an executable action: `admin` + its verb and its object. */
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

interface ExecutableOptions {
  title: string;
  summary: string;
  owningStep: MigrationOwningStep;
  dependsOn?: readonly MigrationActionId[];
  orderedAfter?: readonly MigrationActionId[];
  resumeKey?: string;
  defaultPageSize?: number;
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
    informational: false,
    idempotency: COPY_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: COPY_RECOVERY,
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [A.checkpointV1FirestoreExport],
    orderedAfter: options.orderedAfter ?? [],
  };
}

function verifyStep(
  id: MigrationActionId,
  options: ExecutableOptions & { informational?: boolean },
): ExecutableMigrationStep {
  return {
    kind: 'executable',
    id,
    callable: migrationActionCallableName(id),
    resultKind: 'verification',
    destructive: false,
    paged: true,
    defaultPageSize: options.defaultPageSize ?? 100,
    informational: options.informational ?? false,
    idempotency: VERIFY_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: VERIFY_RECOVERY,
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [],
    orderedAfter: options.orderedAfter ?? [],
  };
}

function deleteStep(id: MigrationActionId, options: ExecutableOptions): ExecutableMigrationStep {
  return {
    kind: 'executable',
    id,
    callable: migrationActionCallableName(id),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: options.defaultPageSize ?? 100,
    informational: false,
    idempotency: DELETE_IDEMPOTENCY,
    resumeKey: options.resumeKey ?? BY_DOCUMENT_ID,
    recovery: DELETE_RECOVERY,
    title: options.title,
    summary: options.summary,
    owningStep: options.owningStep,
    dependsOn: options.dependsOn ?? [],
    orderedAfter: options.orderedAfter ?? [],
  };
}

/** The copies whose verifications must pass before the rebuild reads the games they copied. */
const SOURCE_VERIFICATIONS_FOR_REBUILD = [
  A.verifySportLeagues,
  A.verifyLeagueTeams,
  A.verifyTeamMemberships,
  A.verifyGameRosterPlayers,
  A.verifySportGames,
  A.verifyGameStats,
] as const satisfies readonly MigrationActionId[];

/**
 * Every copy's verification. Each must pass before the cutover is recorded: a failed or skipped
 * record keeps the migration from being declared complete.
 */
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
  // ── Before anything is read ────────────────────────────────────────────────────────────────────
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

  // ── Global roles ───────────────────────────────────────────────────────────────────────────────
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

  // ── App configuration ──────────────────────────────────────────────────────────────────────────
  copyStep(A.copyAppConfig, {
    title: 'Copy the app configuration',
    summary:
      'The version and the banner from `landing/base` become `_appConfig/app`, its switches at their open defaults.',
    owningStep: 'q-core',
    resumeKey: SINGLE_DOCUMENT,
  }),
  copyStep(A.copyLandingPageConfig, {
    title: 'Copy the landing page copy',
    summary:
      'The hero title and the about text become `_appConfig/landingPage`; its picture arrives with the picture carry.',
    owningStep: 'q-core',
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

  // ── Setup's catalogs ───────────────────────────────────────────────────────────────────────────
  copyStep(A.copyWaiverTemplates, {
    title: 'Copy the waiver templates',
    summary: 'Each template under its id, its wording as version 1.',
    owningStep: 'high-risk-callables',
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
    resumeKey: 'The venues in array order; the resume key is the last venue id.',
  }),
  verifyStep(A.verifyGameLocations, {
    title: 'Verify the game locations',
    summary: 'Every V1 venue copied and equal.',
    owningStep: 'q-core',
    dependsOn: [A.copyGameLocations],
    resumeKey: 'The venues in array order; the resume key is the last venue id.',
  }),

  // ── Accounts and identity ──────────────────────────────────────────────────────────────────────
  copyStep(A.copyUserProfiles, {
    title: 'Copy the profiles',
    summary:
      'Each `users` document becomes its profile and its owner-only private document, every account active.',
    owningStep: 'auth',
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
  }),
  verifyStep(A.verifyHistoricalStats, {
    title: 'Verify the historical baselines',
    summary: 'Every V1 baseline copied and equal; a database with none is declared empty.',
    owningStep: 'stat-data-model',
    dependsOn: [A.copyHistoricalStats],
  }),
  copyStep(A.deriveReservedDisplayNames, {
    title: 'Reserve the display names',
    summary:
      'One reservation per copied profile; two names that collide are reported for an admin rename.',
    owningStep: 'auth',
    dependsOn: [A.copyUserProfiles],
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
    dependsOn: [A.copyUserProfiles],
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

  // ── Leagues and teams ──────────────────────────────────────────────────────────────────────────
  copyStep(A.copySportLeagues, {
    title: 'Copy the leagues',
    summary:
      'Each league under its id — closed leagues included; its pictures arrive with the picture carry.',
    owningStep: 'q-core',
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
    dependsOn: [A.copyLeagueTeams, A.copyTeamMemberships],
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
    dependsOn: [A.copyLeagueTeams, A.copyTeamMemberships],
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
  }),
  verifyStep(A.verifyLeagueFreeAgents, {
    title: 'Verify the free-agent signups',
    summary: 'Every V1 signup copied, or absent because joining left it behind.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.copyLeagueFreeAgents],
  }),

  // ── Signed waivers and hardware contracts ──────────────────────────────────────────────────────
  copyStep(A.copySignedWaivers, {
    title: 'Copy the signed waivers',
    summary:
      'Every signed waiver, a ghost’s included, under its id; its signature file stays where it is.',
    owningStep: 'uploads-and-media',
    dependsOn: [A.copyWaiverTemplates],
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
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
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

  // ── Games ──────────────────────────────────────────────────────────────────────────────────────
  copyStep(A.copyGameRosterPlayers, {
    title: 'Copy the game rosters',
    summary:
      'One entry per team per person in each game, from each V1 roster document’s own team and user.',
    owningStep: 'high-risk-callables',
    resumeKey: 'The V1 games by document id; the resume key is the last game id.',
    defaultPageSize: 50,
  }),
  {
    kind: 'executable',
    id: A.resolveUnrosteredStatLine,
    callable: migrationActionCallableName(A.resolveUnrosteredStatLine),
    resultKind: 'write',
    destructive: false,
    paged: false,
    defaultPageSize: 1,
    informational: false,
    idempotency: 'A second resolution of the same line is acknowledged and writes nothing.',
    resumeKey: 'One game, one line; it is never paged.',
    recovery: 'Resolve the line again with the right team, then copy the game again.',
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
    dependsOn: [A.copyGameRosterPlayers],
    orderedAfter: [A.resolveUnrosteredStatLine],
    resumeKey:
      'The V1 games by document id; a game’s documents commit before its id becomes the resume key.',
    defaultPageSize: 20,
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
  }),
  {
    kind: 'executable',
    id: A.reconcileOpenGameRosters,
    callable: migrationActionCallableName(A.reconcileOpenGameRosters),
    resultKind: 'write',
    destructive: false,
    paged: true,
    defaultPageSize: 20,
    informational: false,
    idempotency:
      'Each open game is reconciled through the roster core against the copied memberships; a reconciled game changes nothing on a re-run.',
    resumeKey: 'The open games by document id; the resume key is the last game id.',
    recovery:
      'Run it again: a game held by another operation is reported and reconciled on the next run.',
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

  // ── Pictures ───────────────────────────────────────────────────────────────────────────────────
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

  // ── The ghost names V1 left behind ─────────────────────────────────────────────────────────────
  {
    kind: 'executable',
    id: A.cleanupOrphanGhostPublicUsers,
    callable: migrationActionCallableName(A.cleanupOrphanGhostPublicUsers),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: 100,
    informational: false,
    idempotency:
      'A ghost document is deleted only when nothing references it; a re-run finds nothing further.',
    resumeKey: BY_DOCUMENT_ID,
    recovery: DELETE_RECOVERY,
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

  // ── The derived statistics ─────────────────────────────────────────────────────────────────────
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

  // ── The cutover ────────────────────────────────────────────────────────────────────────────────
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

  // ── Cleanup: each delete gated on the verifications its core asserts ───────────────────────────
  deleteStep(A.deleteV1AdminRoles, {
    title: 'Remove the V1 role maps',
    summary:
      'The `isAdmin` and `referees` fields on `landing/admin`; the document goes with its last carried row.',
    owningStep: 'auth',
    dependsOn: [A.verifyAdminList],
    resumeKey: SINGLE_DOCUMENT,
  }),
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
  }),
  deleteStep(A.deleteV1Waivers, {
    title: 'Delete the V1 waiver templates',
    summary: 'The `waivers` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyWaiverTemplates],
  }),
  deleteStep(A.deleteV1GameLocations, {
    title: 'Remove the V1 venues',
    summary:
      'The `locations` field on `landing/admin`; the document goes with its last carried row.',
    owningStep: 'q-core',
    dependsOn: [A.verifyGameLocations, A.verifyV1Pictures],
    resumeKey: SINGLE_DOCUMENT,
  }),
  deleteStep(A.deleteV1AwardCatalog, {
    title: 'Remove the V1 award catalog',
    summary: 'The `awards` field on `landing/admin`; the document goes with its last carried row.',
    owningStep: 'uploads-and-media',
    dependsOn: [
      A.verifyAwardDefinitions,
      A.verifyUserProfiles,
      A.verifyPublicUsers,
      A.verifyV1Pictures,
    ],
    resumeKey: SINGLE_DOCUMENT,
  }),
  deleteStep(A.deleteV1Users, {
    title: 'Delete the V1 user documents',
    summary: 'Each `users` document with its historical baselines.',
    owningStep: 'auth',
    dependsOn: [A.verifyUserProfiles, A.verifyHistoricalStats, A.verifyReservedDisplayNames],
  }),
  deleteStep(A.deleteV1TeamInvites, {
    title: 'Delete the V1 invitations',
    summary: 'The `teamInvites` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyTeamInvitations],
  }),
  deleteStep(A.deleteV1JoinRequests, {
    title: 'Delete the V1 join requests',
    summary: 'The `joinRequests` collection.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyTeamJoinRequests],
  }),
  deleteStep(A.deleteV1FreeAgentSignups, {
    title: 'Delete the V1 free-agent signups',
    summary: 'The `freeAgentSignups` collection, left-behind signups included.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyLeagueFreeAgents],
  }),
  deleteStep(A.deleteV1TeamMembers, {
    title: 'Delete the V1 memberships',
    summary: 'The `teamMembers` collection.',
    owningStep: 'q-core',
    dependsOn: [A.verifyTeamMemberships],
  }),
  deleteStep(A.deleteV1Teams, {
    title: 'Delete the V1 teams',
    summary: 'The `teams` collection; a team still holding a subcollection is reported and kept.',
    owningStep: 'q-core',
    dependsOn: [A.verifyLeagueTeams],
  }),
  {
    kind: 'executable',
    id: A.revokeV1SignatureDownloadTokens,
    callable: migrationActionCallableName(A.revokeV1SignatureDownloadTokens),
    resultKind: 'write',
    destructive: true,
    paged: true,
    defaultPageSize: 100,
    informational: false,
    idempotency:
      'Removes a kept file’s download token; a file holding none is skipped. No file is moved or deleted.',
    resumeKey: 'The signed waivers by id, then the contracts; the resume key is the record path.',
    recovery: 'Run it again; a file whose token went is skipped.',
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
  }),
  deleteStep(A.deleteV1HardwareContracts, {
    title: 'Delete the V1 hardware contracts',
    summary:
      'Both V1 contract collections; the signature files stay, named by the copied contracts.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyHardwareLoanContracts],
    resumeKey:
      'The V1 collections in turn, each by document id; the resume key is `{collection}/{id}`.',
  }),
  deleteStep(A.deleteV1GameRosters, {
    title: 'Delete the V1 game rosters',
    summary: 'Each V1 game’s `roster` subcollection — never the game document.',
    owningStep: 'high-risk-callables',
    dependsOn: [A.verifyGameRosterPlayers, A.validateStats],
    resumeKey: 'The V1 games by document id; the resume key is the last game id.',
    defaultPageSize: 50,
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
  }),
  deleteStep(A.deleteV1LeagueChats, {
    title: 'Delete the V1 league chats',
    summary:
      'The parked chat documents under each V1 league and its team paths. Any other document found under a league is reported and kept.',
    owningStep: 'migration-console',
    dependsOn: [A.checkpointV1FirestoreExport],
    resumeKey:
      'The V1 leagues by document id; the resume key is the last league id, or `{leagueId}/unfinished` while a league holds more chats than one page deletes.',
    defaultPageSize: 50,
  }),
  deleteStep(A.deleteV1Leagues, {
    title: 'Delete the V1 leagues',
    summary:
      'The `leagues` collection; a league still holding a subcollection is reported and kept.',
    owningStep: 'q-core',
    dependsOn: [A.verifySportLeagues, A.verifyV1Pictures],
    orderedAfter: [A.verifyLeaguePlayerStats, A.deleteV1LeagueChats],
  }),
  deleteStep(A.deleteV1HallOfFame, {
    title: 'Delete the V1 hall of fame',
    summary:
      'The `hallOfFame` collection, once every sport that keeps a hall of fame has its rebuilt document.',
    owningStep: 'stat-data-model',
    dependsOn: [A.verifySportHallOfFame],
  }),
  deleteStep(A.deleteV1ValidationReports, {
    title: 'Delete the V1 validation reports',
    summary:
      'The `validationReports` collection. Nothing is copied: each report describes V1 aggregates at a past moment.',
    owningStep: 'stat-data-model',
    dependsOn: [A.checkpointV1FirestoreExport],
    orderedAfter: [A.validateStats],
  }),
  deleteStep(A.deleteV1AdminStats, {
    title: 'Delete the V1 dashboard counts',
    summary:
      'The `adminStats` collection. Nothing is copied: the dashboard counts are counted live.',
    owningStep: 'q-core',
    dependsOn: [A.checkpointV1FirestoreExport],
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
  }),

  // ── After the cutover ──────────────────────────────────────────────────────────────────────────
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

/** Every step by its id. */
export const MIGRATION_STEP_BY_ID: ReadonlyMap<MigrationActionId, MigrationStep> = new Map(
  MIGRATION_CUTOVER_MANIFEST.map((step) => [step.id, step]),
);

/** The steps of one kind, in cutover order. */
export function migrationStepsOfKind<K extends MigrationStepKind>(
  kind: K,
): Extract<MigrationStep, { kind: K }>[] {
  return MIGRATION_CUTOVER_MANIFEST.filter(
    (step): step is Extract<MigrationStep, { kind: K }> => step.kind === kind,
  );
}
