// The Backstage Guide's videos: the one declaration of each video's identity (id and planned
// title). The system-slot registry derives a video slot per entry.

export const GUIDE_VIDEO_DEFINITIONS = [
  { id: 'ttt-in-five-minutes', plannedTitle: 'TTT in Five Minutes' },
  { id: 'finding-your-way-around', plannedTitle: 'Finding Your Way Around TTT' },
  { id: 'find-something-to-enjoy', plannedTitle: 'Find Something to Enjoy in the Hall' },
  { id: 'start-a-work-as-steward', plannedTitle: 'Start a Work as Steward' },
  { id: 'how-to-join-a-work', plannedTitle: 'How to Join a Work' },
  { id: 'what-is-a-realm', plannedTitle: 'What is a Realm?' },
  { id: 'what-is-a-work', plannedTitle: 'What is a Work?' },
  { id: 'what-is-a-guild', plannedTitle: 'What is a Guild?' },
  { id: 'what-are-stakes', plannedTitle: 'What are Stakes?' },
  { id: 'how-bouquets-and-payouts-will-work', plannedTitle: 'How Bouquets and Payouts Will Work' },
] as const;

export type GuideVideoDefinition = (typeof GUIDE_VIDEO_DEFINITIONS)[number];
export type GuideVideoId = GuideVideoDefinition['id'];

/** The system video slot that holds a Guide video's recording. */
export function guideVideoSlotId<V extends GuideVideoId>(videoId: V): `guide-${V}` {
  return `guide-${videoId}`;
}
