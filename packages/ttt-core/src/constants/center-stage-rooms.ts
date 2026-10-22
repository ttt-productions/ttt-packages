import { APP_ROUTES } from '../paths/app-routes.js';

export type CenterStageRoomKey = 'hall' | 'square' | 'audition';

export interface CenterStageRoom {
  readonly key: CenterStageRoomKey;
  readonly name: string;
  readonly verb: string;
  readonly href: string;
  readonly description: string;
}

export const CENTER_STAGE_ROOMS: readonly CenterStageRoom[] = [
  {
    key: 'hall',
    name: 'The Hall',
    verb: 'Watch, read & listen',
    href: APP_ROUTES.hallLibrary(),
    description:
      'Home to the finished works — read original Tales, listen to Tunes, and watch Television, all made by real people and reviewed before it goes up.',
  },
  {
    key: 'square',
    name: 'The Square',
    verb: "See what's happening",
    href: APP_ROUTES.squareStreetz(),
    description:
      'The community feed. Post your news, follow artisans you admire, and watch the Town Crier announce what’s happening across TTT Productions.',
  },
  {
    key: 'audition',
    name: 'The Audition Stage',
    verb: 'Cast your vote',
    href: APP_ROUTES.auditionBoard(),
    description:
      'Artisans post auditions for their works, and the community votes on the entries. Cast your vote — one per audition, switch it anytime.',
  },
];

export function centerStageRoomEnterLabel(room: Pick<CenterStageRoom, 'name'>): string {
  return `Enter the ${room.name.replace(/^The /, '')} ›`;
}
