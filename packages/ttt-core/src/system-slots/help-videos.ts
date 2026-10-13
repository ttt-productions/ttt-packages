// The Help components' videos: the one declaration of every Help placement — each `?` Help dialog
// in the app — with a stable id, the readable title its dialog shows, and where it sits. The
// system-slot registry derives an optional video slot per entry, so an admin can find any Help
// placement and give it a video. Separate placements never share a slot, even when their written
// Help reads the same.

export const HELP_VIDEO_DEFINITIONS = [
  { id: 'work-project-information', title: 'Work Project Information', location: 'Work page — the Work Project Information section.' },
  { id: 'work-team-communication', title: 'Team Communication', location: 'Work page — the Team Communication (guild chat) section.' },
  { id: 'work-your-team', title: 'Your Team', location: 'Work page — the Your Team section.' },
  { id: 'work-guildmate-users', title: 'Guildmate Users', location: 'Work page — the Guildmate Users list inside Your Team.' },
  { id: 'work-member-stake-shares', title: 'Number of Shares', location: "Work page — a Guildmate's details, beside their Stake count." },
  { id: 'work-member-guild-standings', title: 'Guild Standings', location: "Work page — a Guildmate's details, beside their Guild Standings." },
  { id: 'work-member-trade-professions', title: 'User Trade Professions', location: "Work page — a Guildmate's details, beside their Trade Professions." },
  { id: 'work-pending-invitations', title: 'Pending Invitations', location: 'Work page — the Pending Invitations section.' },
  { id: 'work-invite-by-craft', title: 'Search and Invite by Craft', location: 'Work page — the craft search for inviting an Artisan.' },
  { id: 'work-project-files', title: 'Work Project Files', location: 'Work page — the Work Project Files section.' },
  { id: 'work-find-talent', title: 'Find Talent', location: 'Work page — the Find Talent (commissions) section.' },
  { id: 'work-community-feedback', title: 'Get Community Feedback', location: 'Work page — the Get Community Feedback (auditions) section.' },
  { id: 'work-project-auditions', title: 'Work Project Auditions', location: "Work page — the Work's auditions list." },
  { id: 'work-submit-to-hall', title: 'Submit to the Hall', location: 'Work page — the Submit to the Hall section.' },
  { id: 'work-episodic-publishing', title: 'Episodic Publishing', location: 'Work page — the episodic publishing list inside Submit to the Hall.' },
  { id: 'work-platform-correspondence', title: 'Platform Correspondence', location: 'Work page — the Platform Correspondence section.' },
  { id: 'hall', title: 'Discover Human Creativity', location: 'The Hall — its masthead.' },
  { id: 'square', title: 'The Square', location: 'The Square — its masthead.' },
  { id: 'notice-board', title: 'The Notice Board', location: 'The Notice Board — its masthead.' },
  { id: 'craft-fair', title: 'The Craft Fair', location: 'The Craft Fair — its search bar.' },
  { id: 'audition-stage', title: "Shape TTT's Future", location: 'The Audition Stage — its masthead.' },
  { id: 'audition-sponsored-prize', title: 'Sponsored prize — how it works', location: "An audition card on the Audition Stage and an audition's page — beside a Sponsored audition's prize." },
  { id: 'audition-view-sponsored-prize', title: 'Sponsored prize — how it works', location: "An audition's full view (a Work's or the admin's) — beside a Sponsored audition's prize." },
  { id: 'admin-audition-sponsored-prize', title: 'Sponsored prize — how it works', location: 'Admin → Audition Mngt — the audition form, beside the Sponsored prize field.' },
  { id: 'messages-admin-dispatches', title: 'Important Notifications', location: 'Messages — the admin dispatches section.' },
  { id: 'messages-guild-invites', title: 'Work Project Collaboration Invites', location: 'Messages — the guild invites section.' },
  { id: 'profile-overview', title: 'Your TTT Profile', location: 'Profile page — the profile header.' },
  { id: 'profile-square-activity', title: 'Your Square Activity', location: 'Profile page — the Square activity section.' },
  { id: 'profile-following', title: 'Users You Follow', location: 'Profile page — the Following section.' },
  { id: 'profile-artisan-tools', title: 'Unlock Artisan Creator Tools', location: 'Profile page — the Become an Artisan Creator section.' },
  { id: 'profile-work-projects', title: 'Your Creative Work Projects', location: 'Profile page — the Works section.' },
  { id: 'profile-crafts', title: 'Showcase Your Craft', location: 'Profile page — the Crafts section.' },
] as const;

export type HelpVideoDefinition = (typeof HELP_VIDEO_DEFINITIONS)[number];
export type HelpVideoId = HelpVideoDefinition['id'];

/** The system video slot that holds a Help placement's video. */
export function helpVideoSlotId<V extends HelpVideoId>(helpId: V): `help-${V}` {
  return `help-${helpId}`;
}
