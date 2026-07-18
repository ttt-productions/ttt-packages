// ============================================================================
// CENTER STAGE ROOMS — the pure, durable definitions of the three revolving
// landing/registration-tour rooms (Rule 36). Moved here VERBATIM from the app's
// `center-stage.tsx`. Pure data only: the emblems (`ROOM_EMBLEMS`), React
// components, engraving, and stage layout stay app-owned. Each room's `href` is
// the app route the spotlit poster navigates to.
// ============================================================================

export type CenterStageRoomKey = 'hall' | 'square' | 'audition';

export interface CenterStageRoom {
  readonly key: CenterStageRoomKey;
  readonly name: string;
  readonly verb: string;
  readonly href: string;
  /** One-breath description shown on the audience placard (same words the tour uses). */
  readonly description: string;
}

/** The three rooms, in revolve order. Index 0 (The Hall) opens in the spotlight. */
export const CENTER_STAGE_ROOMS: readonly CenterStageRoom[] = [
  {
    key: 'hall',
    name: 'The Hall',
    verb: 'Watch, read & listen',
    href: '/hall-library',
    description:
      'Home to the finished works — read original Tales, listen to Tunes, and watch Television, all made by real people and reviewed before it goes up.',
  },
  {
    key: 'square',
    name: 'The Square',
    verb: "See what's happening",
    href: '/square-streetz',
    description:
      'The community feed. Post your news, follow artisans you admire, and watch the Town Crier announce what’s happening across TTT Productions.',
  },
  {
    key: 'audition',
    name: 'The Audition Stage',
    verb: 'Cast your vote',
    href: '/audition-board',
    description:
      'Artisans post auditions for their works, and the community votes on the entries. Cast your vote — one per audition, switch it anytime.',
  },
];
