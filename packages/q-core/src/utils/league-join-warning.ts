import { z } from 'zod';
import { teamIdSchema } from '../doc-schemas/atoms.js';
import { teamInvitationIdSchema, teamJoinRequestIdSchema } from '../schemas/atoms.js';

export const LEAGUE_JOIN_WARNING_STATE_KEYS = [
  'onTeam',
  'pendingJoinRequest',
  'pendingInvitation',
  'freeAgentSignup',
] as const;
export type LeagueJoinWarningState = (typeof LEAGUE_JOIN_WARNING_STATE_KEYS)[number];

export const LEAGUE_JOIN_WARNING_ACTED_ON_KEYS = [
  'teamInvitation',
  'teamJoinRequest',
  'leagueFreeAgent',
] as const;
export type LeagueJoinWarningActedOnKind = (typeof LEAGUE_JOIN_WARNING_ACTED_ON_KEYS)[number];

export const leagueJoinWarningActedOnSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('teamInvitation' satisfies LeagueJoinWarningActedOnKind),
      teamInvitationId: teamInvitationIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('teamJoinRequest' satisfies LeagueJoinWarningActedOnKind),
      teamJoinRequestId: teamJoinRequestIdSchema,
    })
    .strict(),
  z.object({ kind: z.literal('leagueFreeAgent' satisfies LeagueJoinWarningActedOnKind) }).strict(),
]);
export type LeagueJoinWarningActedOn = z.infer<typeof leagueJoinWarningActedOnSchema>;

export const LEAGUE_JOIN_WARNING_ACTION_KEYS = [
  'createTeam',
  'acceptInvitation',
  'sendJoinRequest',
  'signUpAsFreeAgent',
  'sendInvitation',
  'acceptJoinRequest',
  'assignFreeAgent',
  'closedLeagueLink',
] as const;
export type LeagueJoinWarningAction = (typeof LEAGUE_JOIN_WARNING_ACTION_KEYS)[number];

export const LEAGUE_JOIN_WARNING_PERSPECTIVE_KEYS = ['self', 'other'] as const;
export type LeagueJoinWarningPerspective = (typeof LEAGUE_JOIN_WARNING_PERSPECTIVE_KEYS)[number];

export const LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION: Readonly<
  Record<LeagueJoinWarningAction, LeagueJoinWarningPerspective>
> = {
  createTeam: 'self',
  acceptInvitation: 'self',
  sendJoinRequest: 'self',
  signUpAsFreeAgent: 'self',
  sendInvitation: 'other',
  acceptJoinRequest: 'other',
  assignFreeAgent: 'other',
  closedLeagueLink: 'other',
};

export interface LeagueJoinWarningFacts {
  memberships: readonly { teamId: string }[];
  pendingJoinRequests: readonly { teamJoinRequestId: string; teamId: string }[];
  pendingInvitations: readonly { teamInvitationId: string; teamId: string }[];
  freeAgentSignup: boolean;
}

export const leagueJoinWarningFindingSchema = z
  .object({ state: z.enum(LEAGUE_JOIN_WARNING_STATE_KEYS), teamId: teamIdSchema.nullable() })
  .strict();
export type LeagueJoinWarningFinding = z.infer<typeof leagueJoinWarningFindingSchema>;

export function computeLeagueJoinWarning(
  facts: LeagueJoinWarningFacts,
  actedOn: LeagueJoinWarningActedOn | null,
): LeagueJoinWarningFinding[] {
  const byTeam = (left: LeagueJoinWarningFinding, right: LeagueJoinWarningFinding) =>
    (left.teamId ?? '').localeCompare(right.teamId ?? '');

  const onTeam = facts.memberships.map((membership) => ({
    state: 'onTeam' as const,
    teamId: membership.teamId,
  }));
  const pendingJoinRequest = facts.pendingJoinRequests
    .filter(
      (request) =>
        !(
          actedOn?.kind === 'teamJoinRequest' &&
          actedOn.teamJoinRequestId === request.teamJoinRequestId
        ),
    )
    .map((request) => ({ state: 'pendingJoinRequest' as const, teamId: request.teamId }));
  const pendingInvitation = facts.pendingInvitations
    .filter(
      (invitation) =>
        !(
          actedOn?.kind === 'teamInvitation' &&
          actedOn.teamInvitationId === invitation.teamInvitationId
        ),
    )
    .map((invitation) => ({ state: 'pendingInvitation' as const, teamId: invitation.teamId }));
  const freeAgentSignup: LeagueJoinWarningFinding[] =
    facts.freeAgentSignup && actedOn?.kind !== 'leagueFreeAgent'
      ? [{ state: 'freeAgentSignup', teamId: null }]
      : [];

  return [
    ...onTeam.sort(byTeam),
    ...pendingJoinRequest.sort(byTeam),
    ...pendingInvitation.sort(byTeam),
    ...freeAgentSignup,
  ];
}

export const LEAGUE_JOIN_WARNING_COPY = {
  title: 'Already in this league',
  confirmLabel: 'Continue',
  cancelLabel: 'Cancel',
  self: {
    onTeam: (teamName: string) => `You are already on ${teamName}.`,
    pendingJoinRequest: (teamName: string) => `You have a request waiting with ${teamName}.`,
    pendingInvitation: (teamName: string) => `You have an invitation waiting from ${teamName}.`,
    freeAgentSignup: () => 'You are signed up as a free agent in this league.',
  },
  other: {
    onTeam: (personName: string, teamName: string) => `${personName} is already on ${teamName}.`,
    pendingJoinRequest: (personName: string, teamName: string) =>
      `${personName} has asked to join ${teamName}.`,
    pendingInvitation: (personName: string, teamName: string) =>
      `${personName} has an invitation waiting from ${teamName}.`,
    freeAgentSignup: (personName: string) =>
      `${personName} is signed up as a free agent in this league.`,
  },
  question: {
    createTeam: () => 'Do you still want to create a new team?',
    acceptInvitation: (targetTeamName: string) => `Do you still want to join ${targetTeamName}?`,
    sendJoinRequest: (targetTeamName: string) =>
      `Do you still want to ask to join ${targetTeamName}?`,
    signUpAsFreeAgent: () => 'Do you still want to sign up as a free agent?',
    sendInvitation: (targetTeamName: string) => `Invite them to ${targetTeamName} anyway?`,
    acceptJoinRequest: (targetTeamName: string) => `Accept them onto ${targetTeamName} anyway?`,
    assignFreeAgent: (targetTeamName: string) => `Assign them to ${targetTeamName} anyway?`,
    closedLeagueLink: (targetTeamName: string) => `Link them to ${targetTeamName} anyway?`,
  } satisfies Record<LeagueJoinWarningAction, (targetTeamName: string) => string>,
} as const;

export interface LeagueJoinWarningText {
  lines: string[];
  question: string;
}

export function formatLeagueJoinWarning(args: {
  action: LeagueJoinWarningAction;
  findings: readonly LeagueJoinWarningFinding[];
  teamName: (teamId: string) => string;
  personName: string;
  targetTeamName: string;
}): LeagueJoinWarningText {
  const perspective = LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION[args.action];
  const lines = args.findings.map((finding) => {
    const team = finding.teamId === null ? '' : args.teamName(finding.teamId);
    if (perspective === 'self') {
      return LEAGUE_JOIN_WARNING_COPY.self[finding.state](team);
    }
    return LEAGUE_JOIN_WARNING_COPY.other[finding.state](args.personName, team);
  });
  return { lines, question: LEAGUE_JOIN_WARNING_COPY.question[args.action](args.targetTeamName) };
}
