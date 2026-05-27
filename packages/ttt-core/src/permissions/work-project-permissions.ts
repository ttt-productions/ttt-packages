export const PROJECT_ROLES = {
  StewardOwner: {
    label: 'StewardOwner',
    description: 'WorkProject stewardOwner. Holds all workProject actions implicitly. Assigned automatically at workProject creation and non-assignable via role-management UIs.',
  },
  ProjectManager: {
    label: 'WorkProject Manager',
    description: 'Can perform every workProject action except granting StewardOwner, ProjectManager, RoleManager, or ShareManager.',
  },
  PublicProjectEditor: {
    label: 'Public WorkProject Editor',
    description: 'Can edit public-facing workProject title, description, and copy.',
  },
  RoleManager: {
    label: 'Role Manager',
    description: 'Can assign and remove ordinary workProject roles without escalating manager or share authority.',
  },
  ShareManager: {
    label: 'Share Manager',
    description: 'Can adjust active member shares and pending invite share offers.',
  },
  InviteManager: {
    label: 'Invite Manager',
    description: 'Can send workProject invites, view invite state, and cancel or revoke pending invites.',
  },
  FileViewer: {
    label: 'File Viewer',
    description: 'Can view workProject files stored in the workProject files subcollection.',
  },
  FileManager: {
    label: 'File Manager',
    description: 'Can upload and delete workProject files.',
  },
  JobManager: {
    label: 'Commission Manager',
    description: 'Can open, close, and delete workProject jobs and manage applicants without starting invite conversations.',
  },
  OpportunityManager: {
    label: 'Audition Manager',
    description: 'Can open, edit, and close workProject opportunities and manage respondents without starting invite conversations.',
  },
  LibraryEditor: {
    label: 'HallLibrary Editor',
    description: 'Can create and edit Tales, Tunes, Television content, categories, and media assets.',
  },
  LibrarySubmitter: {
    label: 'HallLibrary Submitter',
    description: 'Can submit workProject hallLibrary content for admin/hallLibrary review.',
  },
  ChatChannelManager: {
    label: 'Chat Channel Manager',
    description: 'Can create, update, archive, and moderate workProject chat channels.',
  },
} as const;

export type ProjectRoleId = keyof typeof PROJECT_ROLES;
export const PROJECT_ROLE_IDS = Object.keys(PROJECT_ROLES) as ProjectRoleId[];

export const PROJECT_ACTIONS = {
  'workProject.read': {
    label: 'Read workProject',
    description: 'Baseline active-member read floor for internal workProject state.',
    grantedTo: PROJECT_ROLE_IDS,
  },
  'workProject.metadata.update': {
    label: 'Update workProject metadata',
    description: 'Edit working title, description, and public workProject copy.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'PublicProjectEditor'],
  },
  'member.role.update': {
    label: 'Update member roles',
    description: 'Assign or remove workProject roles on active members.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'RoleManager'],
  },
  'member.tradeProfession.update': {
    label: 'Update member tradeProfessions',
    description: 'Assign or remove member tradeProfessions/staffing labels.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'RoleManager'],
  },
  'workProject.shares.manage': {
    label: 'Manage workProject shares',
    description: 'Run workProject share operations under the 1000-share cap.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ShareManager'],
  },
  'workProject.memberShares.addActive': {
    label: 'Add active member shares',
    description: 'Increase shares for an existing active workProject member.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ShareManager'],
  },
  'invite.send': {
    label: 'Send invites',
    description: 'Start a workProject invite conversation and reserve pending shares.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'InviteManager'],
  },
  'invite.list': {
    label: 'List invites',
    description: 'View workProject invite conversation state.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'InviteManager'],
  },
  'invite.revokeAny': {
    label: 'Revoke pending invites',
    description: 'Cancel or revoke pending workProject invites.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'InviteManager'],
  },
  'invite.shares.update': {
    label: 'Update invite shares',
    description: 'Increase shares offered on a pending invite.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ShareManager'],
  },
  'file.view': {
    label: 'View workProject files',
    description: 'Read workProject file metadata from the file subcollection.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'FileViewer', 'FileManager'],
  },
  'file.upload': {
    label: 'Upload workProject files',
    description: 'Upload shared workProject files.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'FileManager'],
  },
  'file.delete': {
    label: 'Delete workProject files',
    description: 'Delete shared workProject files.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'FileManager'],
  },
  'commission.open': {
    label: 'Open jobs',
    description: 'Create workProject commission postings.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'JobManager'],
  },
  'commission.close': {
    label: 'Close jobs',
    description: 'Close workProject commission postings.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'JobManager'],
  },
  'commission.delete': {
    label: 'Delete jobs',
    description: 'Delete workProject commission postings.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'JobManager'],
  },
  'commission.proposalArtisan.save': {
    label: 'Save commission applicants',
    description: 'Save or unsave workProject commission applicants.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'JobManager'],
  },
  'commission.proposalArtisan.reject': {
    label: 'Reject commission applicants',
    description: 'Reject workProject commission applicants.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'JobManager'],
  },
  'audition.open': {
    label: 'Open opportunities',
    description: 'Create workProject audition prompts.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'OpportunityManager'],
  },
  'audition.edit': {
    label: 'Edit opportunities',
    description: 'Edit workProject audition prompts.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'OpportunityManager'],
  },
  'audition.close': {
    label: 'Close opportunities',
    description: 'Close workProject opportunities.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'OpportunityManager'],
  },
  'audition.respondent.manage': {
    label: 'Manage audition respondents',
    description: 'Manage workProject audition respondents without starting invite conversations.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'OpportunityManager'],
  },
  'hallLibrary.chapter.create': {
    label: 'Create Tale chapters',
    description: 'Create Tale chapter content.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.song.create': {
    label: 'Create Tune songs',
    description: 'Create Tune song content.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.show.create': {
    label: 'Create Television shows',
    description: 'Create Television show content.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.tale.details.update': {
    label: 'Update Tale details',
    description: 'Edit Tale details and public copy.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.tune.details.update': {
    label: 'Update Tune details',
    description: 'Edit Tune details and public copy.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.television.details.update': {
    label: 'Update Television details',
    description: 'Edit Television details and public copy.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.chapter.details.update': {
    label: 'Update chapter details',
    description: 'Edit chapter details and body fields.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.song.details.update': {
    label: 'Update song details',
    description: 'Edit song details and media metadata.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.show.details.update': {
    label: 'Update show details',
    description: 'Edit show details and media metadata.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.tale.categories.update': {
    label: 'Update Tale categories',
    description: 'Edit Tale category assignments.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.tune.categories.update': {
    label: 'Update Tune categories',
    description: 'Edit Tune category assignments.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.television.categories.update': {
    label: 'Update Television categories',
    description: 'Edit Television category assignments.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.asset.upload': {
    label: 'Upload hallLibrary assets',
    description: 'Upload or replace covers and sub-item media assets.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibraryEditor'],
  },
  'hallLibrary.review.submit': {
    label: 'Submit hallLibrary review',
    description: 'Submit workProject content for admin/hallLibrary review.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'LibrarySubmitter'],
  },
  'chat.channel.create': {
    label: 'Create chat channels',
    description: 'Create workProject chat channels.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.channel.update': {
    label: 'Update chat channels',
    description: 'Update workProject chat channel settings and access policy.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.channel.archive': {
    label: 'Archive chat channels',
    description: 'Archive workProject chat channels.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.message.moderate': {
    label: 'Moderate chat messages',
    description: 'Update or delete workProject channel messages for moderation.',
    grantedTo: ['StewardOwner', 'ProjectManager', 'ChatChannelManager'],
  },
} as const satisfies Record<string, {
  label: string;
  description: string;
  grantedTo: readonly ProjectRoleId[];
}>;

export type ProjectActionId = keyof typeof PROJECT_ACTIONS;
export const PROJECT_ACTION_IDS = Object.keys(PROJECT_ACTIONS) as ProjectActionId[];

export function isProjectRoleId(value: unknown): value is ProjectRoleId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROJECT_ROLES, value);
}

export function isProjectActionId(value: unknown): value is ProjectActionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROJECT_ACTIONS, value);
}

export function getActionsForProjectRole(role: ProjectRoleId): ProjectActionId[] {
  return PROJECT_ACTION_IDS.filter((action) =>
    (PROJECT_ACTIONS[action].grantedTo as readonly ProjectRoleId[]).includes(role)
  );
}
