export const SYSTEM_ROLE_KEYS = ['admin', 'referee'] as const;
export type SystemRole = (typeof SYSTEM_ROLE_KEYS)[number];

export const USER_STATUS_KEYS = ['active', 'banned'] as const;
export type UserStatus = (typeof USER_STATUS_KEYS)[number];
export const ACTIVE_USER_STATUS = 'active' satisfies UserStatus;
export const BANNED_USER_STATUS = 'banned' satisfies UserStatus;

export const STATUS_RECONCILE_QUEUE_AUTH_EFFECTS = ['accountStatus', 'roleClaims'] as const;
export type StatusReconcileQueueAuthEffect = (typeof STATUS_RECONCILE_QUEUE_AUTH_EFFECTS)[number];
export const ACCOUNT_STATUS_AUTH_EFFECT =
  'accountStatus' as const satisfies StatusReconcileQueueAuthEffect;
export const ROLE_CLAIMS_EFFECT = 'roleClaims' as const satisfies StatusReconcileQueueAuthEffect;

export const TEAM_ROLE_KEYS = ['captain', 'coCaptain', 'player'] as const;
export type TeamRole = (typeof TEAM_ROLE_KEYS)[number];

// The roles that carry captain authority. `firestore.rules` restates this list, because a rules file
// cannot import it.
export const CAPTAIN_TEAM_ROLES = ['captain', 'coCaptain'] as const satisfies readonly TeamRole[];

export const TEAM_CAPTAIN_ROLE = 'captain' as const satisfies TeamRole;

export const TEAM_CO_CAPTAIN_ROLE = 'coCaptain' as const satisfies TeamRole;
export const TEAM_PLAYER_ROLE = 'player' as const satisfies TeamRole;

export const MEMBER_ASSIGNABLE_TEAM_ROLES = [
  TEAM_CO_CAPTAIN_ROLE,
  TEAM_PLAYER_ROLE,
] as const satisfies readonly TeamRole[];
export type MemberAssignableTeamRole = (typeof MEMBER_ASSIGNABLE_TEAM_ROLES)[number];

// `TEAM_ROLE_KEYS` runs from the highest role down.
export function higherTeamRole(left: TeamRole, right: TeamRole): TeamRole {
  return TEAM_ROLE_KEYS.indexOf(left) <= TEAM_ROLE_KEYS.indexOf(right) ? left : right;
}

export const TEAM_MEMBERSHIP_STATUS_KEYS = ['active'] as const;
export type TeamMembershipStatus = (typeof TEAM_MEMBERSHIP_STATUS_KEYS)[number];

export const ACTIVE_TEAM_MEMBERSHIP_STATUS = 'active' as const satisfies TeamMembershipStatus;

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

export const LEAGUE_STATUS_ON_CREATE = 'pending' as const satisfies LeagueStatus;

export const CLOSED_LEAGUE_STATUS = 'closed' as const satisfies LeagueStatus;

export const UPCOMING_LEAGUE_STATUS = 'upcoming' as const satisfies LeagueStatus;
export const ACTIVE_LEAGUE_STATUS = 'active' as const satisfies LeagueStatus;

export const LEAGUE_STATUS_TRANSITIONS: Readonly<Record<LeagueStatus, readonly LeagueStatus[]>> = {
  pending: ['upcoming', 'closed'],
  upcoming: ['active', 'closed'],
  active: ['closed'],
  closed: [],
};

export const OPEN_LEAGUE_STATUS_KEYS: readonly Exclude<
  LeagueStatus,
  typeof CLOSED_LEAGUE_STATUS
>[] = LEAGUE_STATUS_KEYS.filter(
  (status): status is Exclude<LeagueStatus, typeof CLOSED_LEAGUE_STATUS> =>
    status !== CLOSED_LEAGUE_STATUS,
);

export const CURRENT_LEAGUE_STATUS_KEYS = [
  UPCOMING_LEAGUE_STATUS,
  ACTIVE_LEAGUE_STATUS,
] as const satisfies readonly LeagueStatus[];

export const LEAGUE_MODE_KEYS = ['Regular', 'Competitive/Recreational'] as const;
export type LeagueMode = (typeof LEAGUE_MODE_KEYS)[number];

export const TEAM_TYPE_KEYS = ['Competitive', 'Recreational'] as const;
export type TeamType = (typeof TEAM_TYPE_KEYS)[number];

export const TEAM_TYPED_LEAGUE_MODE = 'Competitive/Recreational' as const satisfies LeagueMode;

export const TEAM_TYPE_ON_MODE_SWITCH = 'Recreational' as const satisfies TeamType;

export const GAME_STATUS_KEYS = ['scheduled', 'inprogress', 'completed'] as const;
export type GameStatus = (typeof GAME_STATUS_KEYS)[number];

export const COMPLETED_GAME_STATUS = 'completed' as const satisfies GameStatus;

export const GAME_STATUS_ON_CREATE = 'scheduled' as const satisfies GameStatus;

export const GAME_STATUS_ON_REOPEN = 'inprogress' as const satisfies GameStatus;

export const TEAM_INVITATION_STATUS_KEYS = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type TeamInvitationStatus = (typeof TEAM_INVITATION_STATUS_KEYS)[number];

export const PENDING_TEAM_INVITATION_STATUS = 'pending' as const satisfies TeamInvitationStatus;
export const APPROVED_TEAM_INVITATION_STATUS = 'approved' as const satisfies TeamInvitationStatus;
export const REJECTED_TEAM_INVITATION_STATUS = 'rejected' as const satisfies TeamInvitationStatus;
export const CANCELLED_TEAM_INVITATION_STATUS = 'cancelled' as const satisfies TeamInvitationStatus;

export const TEAM_JOIN_REQUEST_STATUS_KEYS = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type TeamJoinRequestStatus = (typeof TEAM_JOIN_REQUEST_STATUS_KEYS)[number];

export const PENDING_TEAM_JOIN_REQUEST_STATUS = 'pending' as const satisfies TeamJoinRequestStatus;
export const APPROVED_TEAM_JOIN_REQUEST_STATUS =
  'approved' as const satisfies TeamJoinRequestStatus;
export const REJECTED_TEAM_JOIN_REQUEST_STATUS =
  'rejected' as const satisfies TeamJoinRequestStatus;
export const CANCELLED_TEAM_JOIN_REQUEST_STATUS =
  'cancelled' as const satisfies TeamJoinRequestStatus;

export const HARDWARE_LOAN_CONTRACT_STATUS_KEYS = ['pending', 'loaned', 'returned'] as const;
export type HardwareLoanContractStatus = (typeof HARDWARE_LOAN_CONTRACT_STATUS_KEYS)[number];
export const AWARD_GRANT_SKIP_REASON_KEYS = ['noProfile', 'ghost'] as const;
export type AwardGrantSkipReason = (typeof AWARD_GRANT_SKIP_REASON_KEYS)[number];

export const FEATURED_AWARD_SLOT_KEYS = ['primary', 'secondary'] as const;
export type FeaturedAwardSlot = (typeof FEATURED_AWARD_SLOT_KEYS)[number];

export const AWARD_GROUP_TYPE_KEYS = ['team', 'league'] as const;
export type AwardGroupType = (typeof AWARD_GROUP_TYPE_KEYS)[number];

export const AWARD_GROUP_GRANT_ACTION_KEYS = ['grant', 'revoke'] as const;
export type AwardGroupGrantAction = (typeof AWARD_GROUP_GRANT_ACTION_KEYS)[number];

export const AWARD_GROUP_GRANT_STATUS_KEYS = ['pending', 'complete'] as const;
export type AwardGroupGrantStatus = (typeof AWARD_GROUP_GRANT_STATUS_KEYS)[number];

export const AWARD_GROUP_REVOKE_SKIP_KEYS = ['heldBefore', 'heldByAnotherGrant'] as const;
export type AwardGroupRevokeSkip = (typeof AWARD_GROUP_REVOKE_SKIP_KEYS)[number];

export const PENDING_HARDWARE_LOAN_CONTRACT_STATUS =
  'pending' as const satisfies HardwareLoanContractStatus;
export const LOANED_HARDWARE_LOAN_CONTRACT_STATUS =
  'loaned' as const satisfies HardwareLoanContractStatus;
export const RETURNED_HARDWARE_LOAN_CONTRACT_STATUS =
  'returned' as const satisfies HardwareLoanContractStatus;

export const WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS = ['deleted', 'retired'] as const;
export type WaiverTemplateDeleteOutcome = (typeof WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS)[number];

export const STATS_BEACON_ACTION_KEYS = [
  'finalize',
  'reopen',
  'recalculate',
  'correct',
  'historical-update',
  'link',
] as const;
export type StatsBeaconAction = (typeof STATS_BEACON_ACTION_KEYS)[number];

export const GAME_SCOPED_STATS_BEACON_ACTION_KEYS = [
  'finalize',
  'reopen',
] as const satisfies readonly StatsBeaconAction[];
export type GameScopedStatsBeaconAction = (typeof GAME_SCOPED_STATS_BEACON_ACTION_KEYS)[number];

// Listed explicitly, so a status added later is closed until it is named here, never open by default.
export const OPEN_GAME_STATUS_KEYS = [
  'scheduled',
  'inprogress',
] as const satisfies readonly GameStatus[];
export type OpenGameStatus = (typeof OPEN_GAME_STATUS_KEYS)[number];

export function isOpenGameStatus(status: GameStatus): status is OpenGameStatus {
  return (OPEN_GAME_STATUS_KEYS as readonly GameStatus[]).includes(status);
}

export const MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS = ['pending', 'reconciled', 'failed'] as const;
export type MembershipRosterSyncStatus = (typeof MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS)[number];
export const PENDING_ROSTER_SYNC_STATUS = 'pending' as const satisfies MembershipRosterSyncStatus;
export const RECONCILED_ROSTER_SYNC_STATUS =
  'reconciled' as const satisfies MembershipRosterSyncStatus;
export const FAILED_ROSTER_SYNC_STATUS = 'failed' as const satisfies MembershipRosterSyncStatus;

export const WAIVER_WITNESS_AUTHORITY_KEYS = ['captain', 'coCaptain', 'admin', 'referee'] as const;
export type WaiverWitnessAuthority = (typeof WAIVER_WITNESS_AUTHORITY_KEYS)[number];

export const WAIVER_SIGNING_REFUSAL_KEYS = ['waiverChanged'] as const;
export type WaiverSigningRefusal = (typeof WAIVER_SIGNING_REFUSAL_KEYS)[number];

export const WAIVER_TEMPLATE_EDIT_REFUSAL_KEYS = ['templateVersionChanged'] as const;
export type WaiverTemplateEditRefusal = (typeof WAIVER_TEMPLATE_EDIT_REFUSAL_KEYS)[number];

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
  // Appended — the set only grows, and no stored key is ever renamed or removed.
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
  'Sword',
  'Axe',
  'Hammer',
  'Pickaxe',
  'ShieldHalf',
  'Castle',
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
  'Citrus',
  'Banana',
  'Carrot',
  'Pizza',
  'Cookie',
  'Donut',
  'Coffee',
  'Dices',
  'Puzzle',
  'Gamepad2',
  'Spade',
  'Club',
  'Music',
  'Guitar',
  'Hexagon',
  'Triangle',
  'Sailboat',
  'Tractor',
  'Truck',
] as const;
export type TeamIcon = (typeof TEAM_ICON_KEYS)[number];

export const PICTURE_VARIANT_KEYS = ['sm', 'md', 'lg'] as const;
export type PictureVariantKey = (typeof PICTURE_VARIANT_KEYS)[number];

export const GAME_TIER_DISCREPANCY_KIND_KEYS = [
  'gameUnreadable',
  'invalidEvent',
  'eventSequenceMismatch',
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
