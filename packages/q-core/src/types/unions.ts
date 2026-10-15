// Canonical unions (ARCH-102): an `as const` key array with the type derived from it. Zod enums,
// type positions, query filters, and option lists all derive from these arrays — never a quoted
// member.

// The two global roles. Each is a roster on `_systemData/adminList` and a boolean custom claim of
// the same name; the roster is the authority, the claim a fast hint.
export const SYSTEM_ROLE_KEYS = ['admin', 'referee'] as const;
export type SystemRole = (typeof SYSTEM_ROLE_KEYS)[number];

// Account status on the private profile. Only an exact `active` passes the server auth assertion.
export const USER_STATUS_KEYS = ['active', 'banned'] as const;
export type UserStatus = (typeof USER_STATUS_KEYS)[number];
/** The one status that lets an account act. */
export const ACTIVE_USER_STATUS = 'active' satisfies UserStatus;
/** The status an admin's ban sets: the account keeps its data and cannot sign in. */
export const BANNED_USER_STATUS = 'banned' satisfies UserStatus;

// Which post-commit Auth effect queued an account on `statusReconcileQueue/{userId}`:
// `accountStatus` — a status change's disabled flag, status claim, and token revocation, queued in
// the status transaction itself; `roleClaims` — the `admin` / `referee` claims after a failed roster
// claim write.
export const STATUS_RECONCILE_QUEUE_AUTH_EFFECTS = ['accountStatus', 'roleClaims'] as const;
export type StatusReconcileQueueAuthEffect = (typeof STATUS_RECONCILE_QUEUE_AUTH_EFFECTS)[number];
export const ACCOUNT_STATUS_AUTH_EFFECT = 'accountStatus' as const satisfies StatusReconcileQueueAuthEffect;
export const ROLE_CLAIMS_EFFECT = 'roleClaims' as const satisfies StatusReconcileQueueAuthEffect;

export const TEAM_ROLE_KEYS = ['captain', 'coCaptain', 'player'] as const;
export type TeamRole = (typeof TEAM_ROLE_KEYS)[number];

// The roles that carry captain authority. `firestore.rules` restates this list, because a rules file
// cannot import it.
export const CAPTAIN_TEAM_ROLES = ['captain', 'coCaptain'] as const satisfies readonly TeamRole[];

// The one role a team holds at most one of: team creation, the admin captain change, and ghost
// linking write it, and nothing else does.
export const TEAM_CAPTAIN_ROLE = 'captain' as const satisfies TeamRole;

// The two roles below the captain. A co-captain holds every captain power except managing
// co-captains; a player holds none.
export const TEAM_CO_CAPTAIN_ROLE = 'coCaptain' as const satisfies TeamRole;
export const TEAM_PLAYER_ROLE = 'player' as const satisfies TeamRole;

// The roles a member's role change moves a membership between — promoting a player to co-captain,
// or demoting a co-captain to player. The captain's role moves only through the admin's captain
// change, so it is never one of them.
export const MEMBER_ASSIGNABLE_TEAM_ROLES = [TEAM_CO_CAPTAIN_ROLE, TEAM_PLAYER_ROLE] as const satisfies readonly TeamRole[];
export type MemberAssignableTeamRole = (typeof MEMBER_ASSIGNABLE_TEAM_ROLES)[number];

// A ghost link that merges a ghost's membership into the account's keeps one membership with the
// higher of the two roles: `TEAM_ROLE_KEYS` runs from the highest role down.
export function higherTeamRole(left: TeamRole, right: TeamRole): TeamRole {
  return TEAM_ROLE_KEYS.indexOf(left) <= TEAM_ROLE_KEYS.indexOf(right) ? left : right;
}

export const TEAM_MEMBERSHIP_STATUS_KEYS = ['active'] as const;
export type TeamMembershipStatus = (typeof TEAM_MEMBERSHIP_STATUS_KEYS)[number];

// The status a membership grants authority in. Every membership-based check reads it with the role
// (BACKEND-006), so a status added later grants nothing until a check names it.
export const ACTIVE_TEAM_MEMBERSHIP_STATUS = 'active' as const satisfies TeamMembershipStatus;

// How a membership came to exist; absent on a membership whose provenance was never recorded.
export const TEAM_JOIN_METHOD_KEYS = [
  'teamCreation',
  'invite',
  'joinRequest',
  'freeAgent',
  'ghostAdd',
] as const;
export type TeamJoinMethod = (typeof TEAM_JOIN_METHOD_KEYS)[number];

export const LEAGUE_STATUS_KEYS = ['pending', 'upcoming', 'active', 'closed'] as const;
export type LeagueStatus = (typeof LEAGUE_STATUS_KEYS)[number];

// Every league is created unpublished; the admin moves it forward from here.
export const LEAGUE_STATUS_ON_CREATE = 'pending' as const satisfies LeagueStatus;

// A finished season. Its settings stay editable; its status and mode never change again.
export const CLOSED_LEAGUE_STATUS = 'closed' as const satisfies LeagueStatus;

// The two published statuses before a league closes: its teams are forming, then it is in play.
export const UPCOMING_LEAGUE_STATUS = 'upcoming' as const satisfies LeagueStatus;
export const ACTIVE_LEAGUE_STATUS = 'active' as const satisfies LeagueStatus;

// The statuses a league may move to from each status. Movement is forward only, and `closed` is
// final; the status callable refuses any other move.
export const LEAGUE_STATUS_TRANSITIONS: Readonly<Record<LeagueStatus, readonly LeagueStatus[]>> = {
  pending: ['upcoming', 'closed'],
  upcoming: ['active', 'closed'],
  active: ['closed'],
  closed: [],
};

// Every status but closed: a league still being set up, published, or played. Whatever such a
// league is configured with — its waiver template among them — is still in use.
export const OPEN_LEAGUE_STATUS_KEYS: readonly Exclude<LeagueStatus, typeof CLOSED_LEAGUE_STATUS>[] =
  LEAGUE_STATUS_KEYS.filter(
    (status): status is Exclude<LeagueStatus, typeof CLOSED_LEAGUE_STATUS> => status !== CLOSED_LEAGUE_STATUS,
  );

// A league players are part of now or next: published and not yet closed. The admin dashboard's
// active free-agent count covers only these leagues.
export const CURRENT_LEAGUE_STATUS_KEYS = [
  UPCOMING_LEAGUE_STATUS,
  ACTIVE_LEAGUE_STATUS,
] as const satisfies readonly LeagueStatus[];

export const LEAGUE_MODE_KEYS = ['Regular', 'Competitive/Recreational'] as const;
export type LeagueMode = (typeof LEAGUE_MODE_KEYS)[number];

// Present only on teams in a Competitive/Recreational league. In any other mode a team has no type:
// the field is absent, never null.
export const TEAM_TYPE_KEYS = ['Competitive', 'Recreational'] as const;
export type TeamType = (typeof TEAM_TYPE_KEYS)[number];

// The one mode whose teams each carry a `teamType`.
export const TEAM_TYPED_LEAGUE_MODE = 'Competitive/Recreational' as const satisfies LeagueMode;

// The type every team takes when its league switches into `TEAM_TYPED_LEAGUE_MODE`.
export const TEAM_TYPE_ON_MODE_SWITCH = 'Recreational' as const satisfies TeamType;

export const GAME_STATUS_KEYS = ['scheduled', 'inprogress', 'completed'] as const;
export type GameStatus = (typeof GAME_STATUS_KEYS)[number];

// The one status a finished game holds: it was played, and its stats count. Every reader asking
// whether a game was played compares against this rather than naming a status of its own.
export const COMPLETED_GAME_STATUS = 'completed' as const satisfies GameStatus;

// The status a newly scheduled game is created in.
export const GAME_STATUS_ON_CREATE = 'scheduled' as const satisfies GameStatus;

// The status reopen returns a finalized game to: open for scoring again, its record of who played
// kept.
export const GAME_STATUS_ON_REOPEN = 'inprogress' as const satisfies GameStatus;

// An invitation is pending until the invitee accepts (`approved`) or declines (`rejected`) it, or the
// team withdraws it (`cancelled`). A membership on its team made any other way closes it `approved`.
export const TEAM_INVITATION_STATUS_KEYS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type TeamInvitationStatus = (typeof TEAM_INVITATION_STATUS_KEYS)[number];

export const PENDING_TEAM_INVITATION_STATUS = 'pending' as const satisfies TeamInvitationStatus;
export const APPROVED_TEAM_INVITATION_STATUS = 'approved' as const satisfies TeamInvitationStatus;
export const REJECTED_TEAM_INVITATION_STATUS = 'rejected' as const satisfies TeamInvitationStatus;
export const CANCELLED_TEAM_INVITATION_STATUS = 'cancelled' as const satisfies TeamInvitationStatus;

// A join request is pending until the team's leaders accept (`approved`) or reject (`rejected`) it,
// or the requester withdraws it (`cancelled`). A membership on its team made any other way closes it
// `approved`.
export const TEAM_JOIN_REQUEST_STATUS_KEYS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type TeamJoinRequestStatus = (typeof TEAM_JOIN_REQUEST_STATUS_KEYS)[number];

export const PENDING_TEAM_JOIN_REQUEST_STATUS = 'pending' as const satisfies TeamJoinRequestStatus;
export const APPROVED_TEAM_JOIN_REQUEST_STATUS = 'approved' as const satisfies TeamJoinRequestStatus;
export const REJECTED_TEAM_JOIN_REQUEST_STATUS = 'rejected' as const satisfies TeamJoinRequestStatus;
export const CANCELLED_TEAM_JOIN_REQUEST_STATUS = 'cancelled' as const satisfies TeamJoinRequestStatus;

export const HARDWARE_LOAN_CONTRACT_STATUS_KEYS = ['pending', 'loaned', 'returned'] as const;
export type HardwareLoanContractStatus = (typeof HARDWARE_LOAN_CONTRACT_STATUS_KEYS)[number];
// Why an award grant passed over an account it named: it has no profile, or it is a ghost, which
// holds no account.
export const AWARD_GRANT_SKIP_REASON_KEYS = ['noProfile', 'ghost'] as const;
export type AwardGrantSkipReason = (typeof AWARD_GRANT_SKIP_REASON_KEYS)[number];

// The two badges an account shows beside its name.
export const FEATURED_AWARD_SLOT_KEYS = ['primary', 'secondary'] as const;
export type FeaturedAwardSlot = (typeof FEATURED_AWARD_SLOT_KEYS)[number];

// The groups an award is granted to all at once: every active member of a team, or of a league.
export const AWARD_GROUP_TYPE_KEYS = ['team', 'league'] as const;
export type AwardGroupType = (typeof AWARD_GROUP_TYPE_KEYS)[number];

// A decision on one award for one group: grant it to the group's people, or take back what the
// group's grants gave.
export const AWARD_GROUP_GRANT_ACTION_KEYS = ['grant', 'revoke'] as const;
export type AwardGroupGrantAction = (typeof AWARD_GROUP_GRANT_ACTION_KEYS)[number];

// A decision is `pending` until every page of it is done, then `complete`.
export const AWARD_GROUP_GRANT_STATUS_KEYS = ['pending', 'complete'] as const;
export type AwardGroupGrantStatus = (typeof AWARD_GROUP_GRANT_STATUS_KEYS)[number];

// Why taking a group's award back left one person holding it: they held it before the grant reached
// them, or another group's grant still holds it for them.
export const AWARD_GROUP_REVOKE_SKIP_KEYS = ['heldBefore', 'heldByAnotherGrant'] as const;
export type AwardGroupRevokeSkip = (typeof AWARD_GROUP_REVOKE_SKIP_KEYS)[number];

export const PENDING_HARDWARE_LOAN_CONTRACT_STATUS = 'pending' as const satisfies HardwareLoanContractStatus;
export const LOANED_HARDWARE_LOAN_CONTRACT_STATUS = 'loaned' as const satisfies HardwareLoanContractStatus;
export const RETURNED_HARDWARE_LOAN_CONTRACT_STATUS = 'returned' as const satisfies HardwareLoanContractStatus;

// What deleting a waiver template did. A template nothing names is deleted with its versions; one a
// signature or a closed league still names is retired — kept for them, offered to no new league.
export const WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS = ['deleted', 'retired'] as const;
export type WaiverTemplateDeleteOutcome = (typeof WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS)[number];

// What last changed the stats, as announced on the stats beacon; `link` is a ghost link moving a
// game's lines onto an account.
export const STATS_BEACON_ACTION_KEYS = ['finalize', 'reopen', 'recalculate', 'correct', 'historical-update', 'link'] as const;
export type StatsBeaconAction = (typeof STATS_BEACON_ACTION_KEYS)[number];

// The actions that describe one game, so a beacon announcing one names the game, its league, and its
// teams; every other action names no game, and a game id left beside it would point at a stale one.
export const GAME_SCOPED_STATS_BEACON_ACTION_KEYS = ['finalize', 'reopen'] as const satisfies readonly StatsBeaconAction[];
export type GameScopedStatsBeaconAction = (typeof GAME_SCOPED_STATS_BEACON_ACTION_KEYS)[number];

// The statuses a game's roster still follows its teams' memberships in: listed explicitly, so a
// status added later is closed until it is named here, never open by default.
export const OPEN_GAME_STATUS_KEYS = ['scheduled', 'inprogress'] as const satisfies readonly GameStatus[];
export type OpenGameStatus = (typeof OPEN_GAME_STATUS_KEYS)[number];

// Whether a game is still open — not yet finalized — so a scorer may still change it. Both app roots
// ask this one predicate.
export function isOpenGameStatus(status: GameStatus): status is OpenGameStatus {
  return (OPEN_GAME_STATUS_KEYS as readonly GameStatus[]).includes(status);
}

// Where one membership's roster obligation stands. `pending` waits for the reconciliation worker;
// `failed` has spent its retries and waits for an admin's retry; `reconciled` owes nothing.
export const MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS = ['pending', 'reconciled', 'failed'] as const;
export type MembershipRosterSyncStatus = (typeof MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS)[number];
export const PENDING_ROSTER_SYNC_STATUS = 'pending' as const satisfies MembershipRosterSyncStatus;
export const RECONCILED_ROSTER_SYNC_STATUS = 'reconciled' as const satisfies MembershipRosterSyncStatus;
export const FAILED_ROSTER_SYNC_STATUS = 'failed' as const satisfies MembershipRosterSyncStatus;

// The authority a ghost's waiver was signed under: the witness's captaincy on the ghost's team, or
// the global role the admin entry confirmed.
export const WAIVER_WITNESS_AUTHORITY_KEYS = ['captain', 'coCaptain', 'admin', 'referee'] as const;
export type WaiverWitnessAuthority = (typeof WAIVER_WITNESS_AUTHORITY_KEYS)[number];

// Why a signing was refused, named in its details so the signing dialog answers it: `waiverChanged`
// when the wording the signer saw — the template id and version the dialog sent — is no longer the
// league's, so the dialog loads the current wording to read again.
export const WAIVER_SIGNING_REFUSAL_KEYS = ['waiverChanged'] as const;
export type WaiverSigningRefusal = (typeof WAIVER_SIGNING_REFUSAL_KEYS)[number];

// The icon a team picks at creation; the persisted value is the icon component's name.
export const TEAM_ICON_KEYS = [
  'Shield',
  'Swords',
  'Skull',
  'Ghost',
  'Cat',
  'Dog',
  'Bird',
  'Fish',
  'Rabbit',
  'Snail',
  'Turtle',
  'Cherry',
  'Apple',
  'Grape',
  'Rocket',
  'Plane',
  'Ship',
  'Train',
  'Car',
  'Bike',
  'Bolt',
  'Star',
  'Sun',
  'Moon',
  'Cloud',
  'Crown',
  'Diamond',
  'Gem',
  'Anchor',
  // Appended — the set only grows, and no stored key is ever renamed or removed. Seasonal and events.
  'TreePine',
  'Trees',
  'TreeDeciduous',
  'TreePalm',
  'Snowflake',
  'MountainSnow',
  'Gift',
  'PartyPopper',
  'CandyCane',
  'Candy',
  'Lollipop',
  'Cake',
  'Egg',
  'Clover',
  'Heart',
  'Flower',
  'Flower2',
  'Rose',
  'Leaf',
  'Sprout',
  'Wheat',
  'Sunrise',
  'Rainbow',
  'Bell',
  // Awards and sport.
  'Trophy',
  'Medal',
  'Award',
  'Ribbon',
  'Flag',
  'Target',
  'Crosshair',
  'Goal',
  'Dumbbell',
  'Footprints',
  // Power and the elements.
  'Zap',
  'Flame',
  'FlameKindling',
  'Bomb',
  'Atom',
  'Orbit',
  'Sparkles',
  'WandSparkles',
  'Mountain',
  'Tornado',
  'Wind',
  'Droplet',
  'CloudLightning',
  'MoonStar',
  // Arms and strongholds.
  'Sword',
  'Axe',
  'Hammer',
  'Pickaxe',
  'ShieldHalf',
  'Castle',
  // Animals.
  'Squirrel',
  'Rat',
  'Panda',
  'Shrimp',
  'Worm',
  'Bug',
  'Shell',
  'PawPrint',
  'Feather',
  'Bone',
  'Origami',
  // Food.
  'Citrus',
  'Banana',
  'Carrot',
  'Pizza',
  'Cookie',
  'Donut',
  'Coffee',
  // Games and music.
  'Dices',
  'Puzzle',
  'Gamepad2',
  'Spade',
  'Club',
  'Music',
  'Guitar',
  'Hexagon',
  'Triangle',
  // Travel.
  'Sailboat',
  'Tractor',
  'Truck',
] as const;
export type TeamIcon = (typeof TEAM_ICON_KEYS)[number];

// A picture's processed sizes, smallest first: every picture kind declares all three, and a display
// asks for the smallest one that covers its slot.
export const PICTURE_VARIANT_KEYS = ['sm', 'md', 'lg'] as const;
export type PictureVariantKey = (typeof PICTURE_VARIANT_KEYS)[number];

// What a stats check found, game tier first — a game's own numbers are the cause of the aggregate
// findings, so Fix stats repairs games before it rebuilds what they feed.
export const GAME_TIER_DISCREPANCY_KIND_KEYS = [
  // A game whose document the check could not read: nothing else about it could be checked.
  'gameUnreadable',
  'invalidEvent',
  'eventSequenceMismatch',
  // A game whose events do not hold exactly the sequences 1..n: a gap or a duplicate.
  'eventSequenceGap',
  'rollupMismatch',
  'scoreMirrorMismatch',
  'unrosteredStatLine',
  'fantasyPointsStale',
  'finalRecordMissing',
  'finalRecordMismatch',
  'participationSnapshotMismatch',
  'gameHeld',
] as const;
export const AGGREGATE_TIER_DISCREPANCY_KIND_KEYS = [
  'aggregateMismatch',
  'aggregateEntryStale',
  'aggregateEntryMissing',
  'hallOfFameLifetimeMismatch',
] as const;
export const STATS_DISCREPANCY_KIND_KEYS = [
  ...GAME_TIER_DISCREPANCY_KIND_KEYS,
  ...AGGREGATE_TIER_DISCREPANCY_KIND_KEYS,
] as const;
export type StatsDiscrepancyKind = (typeof STATS_DISCREPANCY_KIND_KEYS)[number];
