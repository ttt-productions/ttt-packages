export const BACKSTAGE_GUIDE_TOPIC_IDS = [
  'realms',
  'works',
  'guilds',
  'stakes',
  'enjoy-the-hall',
  'find-your-way-around',
  'start-a-work',
  'join-a-work',
] as const;

export type BackstageGuideTopicId = (typeof BACKSTAGE_GUIDE_TOPIC_IDS)[number];
