export const PROJECT_ROLES = {
  Owner: {
    label: 'Owner',
    description: 'Project owner. Holds all project actions implicitly. Assigned automatically at project creation and non-assignable via role-management UIs.',
  },
  ProjectManager: {
    label: 'Project Manager',
    description: 'Can perform every project action except granting Owner, ProjectManager, RoleManager, or ShareManager.',
  },
  PublicProjectEditor: {
    label: 'Public Project Editor',
    description: 'Can edit public-facing project title, description, and copy.',
  },
  RoleManager: {
    label: 'Role Manager',
    description: 'Can assign and remove ordinary project roles without escalating manager or share authority.',
  },
  ShareManager: {
    label: 'Share Manager',
    description: 'Can adjust active member shares and pending invite share offers.',
  },
  InviteManager: {
    label: 'Invite Manager',
    description: 'Can send project invites, view invite state, and cancel or revoke pending invites.',
  },
  FileViewer: {
    label: 'File Viewer',
    description: 'Can view project files stored in the project files subcollection.',
  },
  FileManager: {
    label: 'File Manager',
    description: 'Can upload and delete project files.',
  },
  JobManager: {
    label: 'Job Manager',
    description: 'Can open, close, and delete project jobs and manage applicants without starting invite conversations.',
  },
  OpportunityManager: {
    label: 'Opportunity Manager',
    description: 'Can open, edit, and close project opportunities and manage respondents without starting invite conversations.',
  },
  LibraryEditor: {
    label: 'Library Editor',
    description: 'Can create and edit Tales, Tunes, Television content, categories, and media assets.',
  },
  LibrarySubmitter: {
    label: 'Library Submitter',
    description: 'Can submit project library content for admin/library review.',
  },
  ChatChannelManager: {
    label: 'Chat Channel Manager',
    description: 'Can create, update, archive, and moderate project chat channels.',
  },
} as const;

export type ProjectRoleId = keyof typeof PROJECT_ROLES;
export const PROJECT_ROLE_IDS = Object.keys(PROJECT_ROLES) as ProjectRoleId[];

export const PROJECT_ACTIONS = {
  'project.read': {
    label: 'Read project',
    description: 'Baseline active-member read floor for internal project state.',
    grantedTo: PROJECT_ROLE_IDS,
  },
  'project.metadata.update': {
    label: 'Update project metadata',
    description: 'Edit working title, description, and public project copy.',
    grantedTo: ['Owner', 'ProjectManager', 'PublicProjectEditor'],
  },
  'member.role.update': {
    label: 'Update member roles',
    description: 'Assign or remove project roles on active members.',
    grantedTo: ['Owner', 'ProjectManager', 'RoleManager'],
  },
  'member.profession.update': {
    label: 'Update member professions',
    description: 'Assign or remove member professions/staffing labels.',
    grantedTo: ['Owner', 'ProjectManager', 'RoleManager'],
  },
  'project.shares.manage': {
    label: 'Manage project shares',
    description: 'Run project share operations under the 1000-share cap.',
    grantedTo: ['Owner', 'ProjectManager', 'ShareManager'],
  },
  'project.memberShares.addActive': {
    label: 'Add active member shares',
    description: 'Increase shares for an existing active project member.',
    grantedTo: ['Owner', 'ProjectManager', 'ShareManager'],
  },
  'invite.send': {
    label: 'Send invites',
    description: 'Start a project invite conversation and reserve pending shares.',
    grantedTo: ['Owner', 'ProjectManager', 'InviteManager'],
  },
  'invite.list': {
    label: 'List invites',
    description: 'View project invite conversation state.',
    grantedTo: ['Owner', 'ProjectManager', 'InviteManager'],
  },
  'invite.revokeAny': {
    label: 'Revoke pending invites',
    description: 'Cancel or revoke pending project invites.',
    grantedTo: ['Owner', 'ProjectManager', 'InviteManager'],
  },
  'invite.shares.update': {
    label: 'Update invite shares',
    description: 'Increase shares offered on a pending invite.',
    grantedTo: ['Owner', 'ProjectManager', 'ShareManager'],
  },
  'file.view': {
    label: 'View project files',
    description: 'Read project file metadata from the file subcollection.',
    grantedTo: ['Owner', 'ProjectManager', 'FileViewer', 'FileManager'],
  },
  'file.upload': {
    label: 'Upload project files',
    description: 'Upload shared project files.',
    grantedTo: ['Owner', 'ProjectManager', 'FileManager'],
  },
  'file.delete': {
    label: 'Delete project files',
    description: 'Delete shared project files.',
    grantedTo: ['Owner', 'ProjectManager', 'FileManager'],
  },
  'job.open': {
    label: 'Open jobs',
    description: 'Create project job postings.',
    grantedTo: ['Owner', 'ProjectManager', 'JobManager'],
  },
  'job.close': {
    label: 'Close jobs',
    description: 'Close project job postings.',
    grantedTo: ['Owner', 'ProjectManager', 'JobManager'],
  },
  'job.delete': {
    label: 'Delete jobs',
    description: 'Delete project job postings.',
    grantedTo: ['Owner', 'ProjectManager', 'JobManager'],
  },
  'job.applicant.save': {
    label: 'Save job applicants',
    description: 'Save or unsave project job applicants.',
    grantedTo: ['Owner', 'ProjectManager', 'JobManager'],
  },
  'job.applicant.reject': {
    label: 'Reject job applicants',
    description: 'Reject project job applicants.',
    grantedTo: ['Owner', 'ProjectManager', 'JobManager'],
  },
  'opportunity.open': {
    label: 'Open opportunities',
    description: 'Create project opportunity prompts.',
    grantedTo: ['Owner', 'ProjectManager', 'OpportunityManager'],
  },
  'opportunity.edit': {
    label: 'Edit opportunities',
    description: 'Edit project opportunity prompts.',
    grantedTo: ['Owner', 'ProjectManager', 'OpportunityManager'],
  },
  'opportunity.close': {
    label: 'Close opportunities',
    description: 'Close project opportunities.',
    grantedTo: ['Owner', 'ProjectManager', 'OpportunityManager'],
  },
  'opportunity.respondent.manage': {
    label: 'Manage opportunity respondents',
    description: 'Manage project opportunity respondents without starting invite conversations.',
    grantedTo: ['Owner', 'ProjectManager', 'OpportunityManager'],
  },
  'library.chapter.create': {
    label: 'Create Tale chapters',
    description: 'Create Tale chapter content.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.song.create': {
    label: 'Create Tune songs',
    description: 'Create Tune song content.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.show.create': {
    label: 'Create Television shows',
    description: 'Create Television show content.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.tale.details.update': {
    label: 'Update Tale details',
    description: 'Edit Tale details and public copy.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.tune.details.update': {
    label: 'Update Tune details',
    description: 'Edit Tune details and public copy.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.television.details.update': {
    label: 'Update Television details',
    description: 'Edit Television details and public copy.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.chapter.details.update': {
    label: 'Update chapter details',
    description: 'Edit chapter details and body fields.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.song.details.update': {
    label: 'Update song details',
    description: 'Edit song details and media metadata.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.show.details.update': {
    label: 'Update show details',
    description: 'Edit show details and media metadata.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.tale.categories.update': {
    label: 'Update Tale categories',
    description: 'Edit Tale category assignments.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.tune.categories.update': {
    label: 'Update Tune categories',
    description: 'Edit Tune category assignments.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.television.categories.update': {
    label: 'Update Television categories',
    description: 'Edit Television category assignments.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.asset.upload': {
    label: 'Upload library assets',
    description: 'Upload or replace covers and sub-item media assets.',
    grantedTo: ['Owner', 'ProjectManager', 'LibraryEditor'],
  },
  'library.review.submit': {
    label: 'Submit library review',
    description: 'Submit project content for admin/library review.',
    grantedTo: ['Owner', 'ProjectManager', 'LibrarySubmitter'],
  },
  'chat.channel.create': {
    label: 'Create chat channels',
    description: 'Create project chat channels.',
    grantedTo: ['Owner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.channel.update': {
    label: 'Update chat channels',
    description: 'Update project chat channel settings and access policy.',
    grantedTo: ['Owner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.channel.archive': {
    label: 'Archive chat channels',
    description: 'Archive project chat channels.',
    grantedTo: ['Owner', 'ProjectManager', 'ChatChannelManager'],
  },
  'chat.message.moderate': {
    label: 'Moderate chat messages',
    description: 'Update or delete project channel messages for moderation.',
    grantedTo: ['Owner', 'ProjectManager', 'ChatChannelManager'],
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
