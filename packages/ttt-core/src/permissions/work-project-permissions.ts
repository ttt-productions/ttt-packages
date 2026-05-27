export const GUILD_STANDINGS = {
  StewardOwner: {
    label: 'StewardOwner',
    description: 'WorkProject stewardOwner. Holds all workProject actions implicitly. Assigned automatically at workProject creation and non-assignable via role-management UIs.',
  },
  WorkProjectManager: {
    label: 'WorkProject Manager',
    description: 'Can perform every workProject action except granting StewardOwner, WorkProjectManager, GuildStandingManager, or StakeShareManager.',
  },
  PublicWorkProjectEditor: {
    label: 'Public WorkProject Editor',
    description: 'Can edit public-facing workProject title, description, and copy.',
  },
  GuildStandingManager: {
    label: 'Guild Standing Manager',
    description: 'Can assign and remove ordinary workProject guild standings without escalating manager or share authority.',
  },
  StakeShareManager: {
    label: 'Share Manager',
    description: 'Can adjust active member shares and pending invite share offers.',
  },
  InviteManager: {
    label: 'Invite Manager',
    description: 'Can send workProject invites, view invite state, and cancel or revoke pending invites.',
  },
  WorkAssetViewer: {
    label: 'Work Asset Viewer',
    description: 'Can view workProject assets stored in the work-asset subcollection.',
  },
  WorkAssetManager: {
    label: 'Work Asset Manager',
    description: 'Can upload and delete workProject assets.',
  },
  CommissionManager: {
    label: 'Commission Manager',
    description: 'Can open, close, and delete workProject commissions and manage proposals without starting invite conversations.',
  },
  AuditionManager: {
    label: 'Audition Manager',
    description: 'Can open, edit, and close workProject auditions and manage respondents without starting invite conversations.',
  },
  HallLibraryEditor: {
    label: 'HallLibrary Editor',
    description: 'Can create and edit Tales, Tunes, Television content, categories, and media assets.',
  },
  HallLibrarySubmitter: {
    label: 'HallLibrary Submitter',
    description: 'Can submit workProject hallLibrary content for admin/hallLibrary review.',
  },
  GuildChatChannelManager: {
    label: 'Chat Channel Manager',
    description: 'Can create, update, archive, and moderate workProject chat channels.',
  },
} as const;

export type GuildStandingId = keyof typeof GUILD_STANDINGS;
export const GUILD_STANDING_IDS = Object.keys(GUILD_STANDINGS) as GuildStandingId[];

export const WORK_PROJECT_ACTIONS = {
  'workProject.read': {
    label: 'Read workProject',
    description: 'Baseline active-member read floor for internal workProject state.',
    grantedTo: GUILD_STANDING_IDS,
  },
  'workProject.metadata.update': {
    label: 'Update workProject metadata',
    description: 'Edit working title, description, and public workProject copy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'PublicWorkProjectEditor'],
  },
  'member.guildStanding.update': {
    label: 'Update member guild standings',
    description: 'Assign or remove workProject guild standings on active members.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildStandingManager'],
  },
  'member.tradeProfession.update': {
    label: 'Update member tradeProfessions',
    description: 'Assign or remove member tradeProfessions/staffing labels.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildStandingManager'],
  },
  'workProject.stakeShares.manage': {
    label: 'Manage workProject shares',
    description: 'Run workProject share operations under the 1000-share cap.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'StakeShareManager'],
  },
  'workProject.stakeShares.addActive': {
    label: 'Add active member shares',
    description: 'Increase shares for an existing active workProject member.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'StakeShareManager'],
  },
  'guildInvite.send': {
    label: 'Send invites',
    description: 'Start a workProject invite conversation and reserve pending shares.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'InviteManager'],
  },
  'guildInvite.list': {
    label: 'List invites',
    description: 'View workProject invite conversation state.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'InviteManager'],
  },
  'guildInvite.revokeAny': {
    label: 'Revoke pending invites',
    description: 'Cancel or revoke pending workProject invites.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'InviteManager'],
  },
  'guildInvite.stakeShares.update': {
    label: 'Update invite shares',
    description: 'Increase shares offered on a pending invite.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'StakeShareManager'],
  },
  'workAsset.view': {
    label: 'View work assets',
    description: 'Read workProject asset metadata from the work-asset subcollection.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'WorkAssetViewer', 'WorkAssetManager'],
  },
  'workAsset.upload': {
    label: 'Upload work assets',
    description: 'Upload shared workProject assets.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'WorkAssetManager'],
  },
  'workAsset.delete': {
    label: 'Delete work assets',
    description: 'Delete shared workProject assets.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'WorkAssetManager'],
  },
  'commission.open': {
    label: 'Open commissions',
    description: 'Create workProject commission postings.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'CommissionManager'],
  },
  'commission.close': {
    label: 'Close commissions',
    description: 'Close workProject commission postings.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'CommissionManager'],
  },
  'commission.delete': {
    label: 'Delete commissions',
    description: 'Delete workProject commission postings.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'CommissionManager'],
  },
  'commission.commissionProposal.save': {
    label: 'Save commission proposals',
    description: 'Save or unsave workProject commission proposals.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'CommissionManager'],
  },
  'commission.commissionProposal.reject': {
    label: 'Reject commission proposals',
    description: 'Reject workProject commission proposals.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'CommissionManager'],
  },
  'audition.open': {
    label: 'Open auditions',
    description: 'Create workProject audition prompts.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'AuditionManager'],
  },
  'audition.edit': {
    label: 'Edit auditions',
    description: 'Edit workProject audition prompts.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'AuditionManager'],
  },
  'audition.close': {
    label: 'Close auditions',
    description: 'Close workProject auditions.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'AuditionManager'],
  },
  'audition.respondent.manage': {
    label: 'Manage audition respondents',
    description: 'Manage workProject audition respondents without starting invite conversations.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'AuditionManager'],
  },
  'hallLibrary.chapter.create': {
    label: 'Create Tale chapters',
    description: 'Create Tale chapter content.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tuneTrack.create': {
    label: 'Create Tune tracks',
    description: 'Create Tune track content.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.televisionEpisode.create': {
    label: 'Create Television episodes',
    description: 'Create Television episode content.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tale.details.update': {
    label: 'Update Tale details',
    description: 'Edit Tale details and public copy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tune.details.update': {
    label: 'Update Tune details',
    description: 'Edit Tune details and public copy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.television.details.update': {
    label: 'Update Television details',
    description: 'Edit Television details and public copy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.chapter.details.update': {
    label: 'Update chapter details',
    description: 'Edit chapter details and body fields.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tuneTrack.details.update': {
    label: 'Update track details',
    description: 'Edit track details and media metadata.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.televisionEpisode.details.update': {
    label: 'Update episode details',
    description: 'Edit episode details and media metadata.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tale.categories.update': {
    label: 'Update Tale categories',
    description: 'Edit Tale category assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tune.categories.update': {
    label: 'Update Tune categories',
    description: 'Edit Tune category assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.television.categories.update': {
    label: 'Update Television categories',
    description: 'Edit Television category assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.asset.upload': {
    label: 'Upload hallLibrary assets',
    description: 'Upload or replace covers and sub-item media assets.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.review.submit': {
    label: 'Submit hallLibrary review',
    description: 'Submit workProject content for admin/hallLibrary review.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibrarySubmitter'],
  },
  'guildChatChannel.create': {
    label: 'Create chat channels',
    description: 'Create workProject chat channels.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildChatChannelManager'],
  },
  'guildChatChannel.update': {
    label: 'Update chat channels',
    description: 'Update workProject chat channel settings and access policy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildChatChannelManager'],
  },
  'guildChatChannel.archive': {
    label: 'Archive chat channels',
    description: 'Archive workProject chat channels.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildChatChannelManager'],
  },
  'guildChatMessage.moderate': {
    label: 'Moderate chat messages',
    description: 'Update or delete workProject channel messages for moderation.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildChatChannelManager'],
  },
} as const satisfies Record<string, {
  label: string;
  description: string;
  grantedTo: readonly GuildStandingId[];
}>;

export type WorkProjectActionId = keyof typeof WORK_PROJECT_ACTIONS;
export const WORK_PROJECT_ACTION_IDS = Object.keys(WORK_PROJECT_ACTIONS) as WorkProjectActionId[];

export function isGuildStandingId(value: unknown): value is GuildStandingId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GUILD_STANDINGS, value);
}

export function isWorkProjectActionId(value: unknown): value is WorkProjectActionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WORK_PROJECT_ACTIONS, value);
}

export function getActionsForGuildStanding(role: GuildStandingId): WorkProjectActionId[] {
  return WORK_PROJECT_ACTION_IDS.filter((action) =>
    (WORK_PROJECT_ACTIONS[action].grantedTo as readonly GuildStandingId[]).includes(role)
  );
}



