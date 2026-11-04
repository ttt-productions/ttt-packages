export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'sign_up',
  'login',
  'game_finalized',
  'stat_recorded',
  'ghost_linked',
  'team_joined',
  'free_agent_signed_up',
  'free_agent_withdrawn',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
