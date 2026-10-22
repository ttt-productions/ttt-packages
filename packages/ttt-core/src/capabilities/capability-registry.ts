import type { FileOrigin } from '../media/file-origin.js';

export type CapabilityId =
  | 'account.becomeArtisan'
  | 'square.post'
  | 'square.acceptAgreements'
  | 'pledge.create'
  | 'messaging.guildInvite'
  | 'messaging.send'
  | 'messaging.fileShare'
  | 'collaboration.commissionProposal'
  | 'collaboration.auditionEntry'
  | 'stakeShares.hold'
  | 'upload.origin';

export type CapabilityAgeRequirement = 'adult18Plus' | 'none';

export interface CapabilityDefinition {
  id: CapabilityId;
  description: string;
  ageRequirement: CapabilityAgeRequirement;
  bilateral: boolean;
  uploadOrigins: readonly FileOrigin[];
}

export const ADULT_ONLY_UPLOAD_ORIGINS = [
  'squareStreetz',
  'commission-posting',
  'commission-proposal',
  'audition-prompt',
  'audition-entry',
  'hallLibrary-cover-square',
  'hallLibrary-cover-poster',
  'hallLibrary-cover-cinematic',
  'realm-cover',
  'chapter-photo',
  'tune-track-photo',
  'tune-track-audio',
  'television-episode-photo',
  'television-episode-video',
  'conversation-file',
  'work-asset',
] as const satisfies readonly FileOrigin[];

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  'account.becomeArtisan': {
    id: 'account.becomeArtisan',
    description: 'Become an artisan creator (privilege + stake-share eligibility).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'square.post': {
    id: 'square.post',
    description: 'Create a Square Streetz post.',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['squareStreetz'],
  },
  'square.acceptAgreements': {
    id: 'square.acceptAgreements',
    description: 'Accept the Square Streetz posting agreements.',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'pledge.create': {
    id: 'pledge.create',
    description: 'Create a pledge / payment (18+ only, pledge-only payments).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'messaging.guildInvite': {
    id: 'messaging.guildInvite',
    description: 'Send a guild invite (opens an invite-conversation thread).',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: [],
  },
  'messaging.send': {
    id: 'messaging.send',
    description: 'Send a chat / invite-thread message.',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: [],
  },
  'messaging.fileShare': {
    id: 'messaging.fileShare',
    description: 'Share a Conversation File in an invite / admin-support conversation.',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: ['conversation-file'],
  },
  'collaboration.commissionProposal': {
    id: 'collaboration.commissionProposal',
    description: 'Submit a commission proposal (artisan collaboration surface).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['commission-proposal'],
  },
  'collaboration.auditionEntry': {
    id: 'collaboration.auditionEntry',
    description: 'Submit an audition entry (artisan collaboration surface).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['audition-entry'],
  },
  'stakeShares.hold': {
    id: 'stakeShares.hold',
    description: 'Hold stake shares (guild membership / revenue).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'upload.origin': {
    id: 'upload.origin',
    description: 'Initiate an upload for an adult-only origin (startUpload gate).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ADULT_ONLY_UPLOAD_ORIGINS,
  },
};

export const ALL_CAPABILITY_IDS = Object.keys(CAPABILITY_REGISTRY) as CapabilityId[];

export interface AgeCapabilityContext {
  is18Plus: boolean;
  accountCapabilityVersion: number;
}

export function contextSatisfies(capability: CapabilityId, ctx: AgeCapabilityContext): boolean {
  const def = CAPABILITY_REGISTRY[capability];
  if (def.ageRequirement === 'none') return true;
  return ctx.is18Plus === true;
}

export function uploadOriginRequires18Plus(origin: string): boolean {
  return (ADULT_ONLY_UPLOAD_ORIGINS as readonly string[]).includes(origin);
}
