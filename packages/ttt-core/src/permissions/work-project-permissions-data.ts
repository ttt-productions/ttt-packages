export const GUILD_STANDINGS = {
  StewardOwner: {
    label: 'Steward',
    description: 'Work steward. Holds all workProject actions implicitly. Assigned automatically at workProject creation and non-assignable via guild standing management UIs.',
  },
  WorkProjectManager: {
    label: 'WorkProject Manager',
    description: 'Can perform every workProject action except granting Steward, WorkProjectManager, GuildStandingManager, or StakeShareManager.',
  },
  PublicWorkProjectEditor: {
    label: 'Public WorkProject Editor',
    description: 'Can edit public-facing workProject title, description, and copy.',
  },
  GuildStandingManager: {
    label: 'Guild Standing Manager',
    description: 'Can assign and remove ordinary workProject guild standings without escalating manager or stake-share authority.',
  },
  StakeShareManager: {
    label: 'Stake Share Manager',
    description: 'Can adjust active Guildmate stakes and pending invite stake offers.',
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
    label: 'Hall Editor',
    description: 'Can create and edit Tales, Tunes, Television content, Genres, and media assets.',
  },
  HallLibrarySubmitter: {
    label: 'Hall Submitter',
    description: 'Can submit workProject hall content for admin hall review.',
  },
  GuildChatChannelManager: {
    label: 'Guild Chat Channel Manager',
    description: 'Can create, update, archive, and moderate workProject chat channels.',
  },
} as const;

export type GuildStandingId = keyof typeof GUILD_STANDINGS;
export const GUILD_STANDING_IDS = Object.keys(GUILD_STANDINGS) as GuildStandingId[];
export const GUILD_STANDING_VALUE_BY_ID = {
  StewardOwner: 'Steward',
  WorkProjectManager: 'WorkProjectManager',
  PublicWorkProjectEditor: 'PublicWorkProjectEditor',
  GuildStandingManager: 'GuildStandingManager',
  StakeShareManager: 'StakeShareManager',
  InviteManager: 'InviteManager',
  WorkAssetViewer: 'WorkAssetViewer',
  WorkAssetManager: 'WorkAssetManager',
  CommissionManager: 'CommissionManager',
  AuditionManager: 'AuditionManager',
  HallLibraryEditor: 'HallLibraryEditor',
  HallLibrarySubmitter: 'HallLibrarySubmitter',
  GuildChatChannelManager: 'GuildChatChannelManager',
} as const satisfies Record<GuildStandingId, string>;
export type GuildStandingValue = (typeof GUILD_STANDING_VALUE_BY_ID)[GuildStandingId];
export const GUILD_STANDING_VALUES = Object.values(GUILD_STANDING_VALUE_BY_ID) as GuildStandingValue[];

export const WORK_PROJECT_ACTIONS = {
  'workProject.read': {
    label: 'Read workProject',
    description: 'Baseline active-Guildmate read floor for internal workProject state.',
    grantedTo: GUILD_STANDING_IDS,
  },
  'workProject.metadata.update': {
    label: 'Update workProject metadata',
    description: 'Edit working title, description, and public workProject copy.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'PublicWorkProjectEditor'],
  },
  'guildmateUser.guildStanding.update': {
    label: 'Update Guildmate guild standings',
    description: 'Assign or remove workProject guild standings on active Guildmates.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildStandingManager'],
  },
  'guildmateUser.tradeProfession.update': {
    label: 'Update Guildmate tradeProfessions',
    description: 'Assign or remove Guildmate tradeProfessions/staffing labels.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'GuildStandingManager'],
  },
  'workProject.stakeShares.manage': {
    label: 'Manage workProject stakes',
    description: 'Run workProject stake-share operations under the 1000-stake cap.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'StakeShareManager'],
  },
  'workProject.stakeShares.addActive': {
    label: 'Add active Guildmate stakes',
    description: 'Increase stakes for an existing active workProject Guildmate.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'StakeShareManager'],
  },
  'guildInvite.send': {
    label: 'Send invites',
    description: 'Start a workProject invite conversation and reserve pending stakes.',
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
    label: 'Update invite stakes',
    description: 'Increase stakes offered on a pending invite.',
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
  'hallLibrary.tale.workGenres.update': {
    label: 'Update Tale Genres',
    description: 'Edit Tale Genre assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.tune.workGenres.update': {
    label: 'Update Tune Genres',
    description: 'Edit Tune Genre assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.television.workGenres.update': {
    label: 'Update Television Genres',
    description: 'Edit Television Genre assignments.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.asset.upload': {
    label: 'Upload hallLibrary assets',
    description: 'Upload or replace covers and sub-item media assets.',
    grantedTo: ['StewardOwner', 'WorkProjectManager', 'HallLibraryEditor'],
  },
  'hallLibrary.review.submit': {
    label: 'Submit hall review',
    description: 'Submit workProject content for admin hall review.',
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



