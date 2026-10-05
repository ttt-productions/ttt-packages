// System slots: the admin-managed places the app shows a founder-recorded video or names a special
// account. Each surface is one registry entry; its value lives in Firestore and is set from the
// admin System Slots view, never in code.
//
// Every `uid` / `uidList` slot is PUBLIC data: its values are stored in the public `_appConfig`
// bucket, so a slot that names accounts is readable by anyone, signed in or not.

import { z } from 'zod';
import { GUIDE_VIDEO_DEFINITIONS, guideVideoSlotId } from './guide-videos.js';

/** `video` holds one processed video; `uid` names one account; `uidList` names an ordered list. */
export const SystemSlotKindSchema = z.enum(['video', 'uid', 'uidList']);
export type SystemSlotKind = z.infer<typeof SystemSlotKindSchema>;

export interface SystemSlotDefinition {
  readonly id: string;
  readonly kind: SystemSlotKind;
  /** The admin view's row title. */
  readonly label: string;
  /** Where the slot appears, in one sentence. */
  readonly description: string;
}

const GUIDE_VIDEO_SLOTS = GUIDE_VIDEO_DEFINITIONS.map((video) => ({
  id: guideVideoSlotId(video.id),
  kind: 'video' as const,
  label: video.plannedTitle,
  description: 'A Backstage Guide video, shown wherever the Guide offers it.',
}));

export const SYSTEM_SLOTS = [
  {
    id: 'founder',
    kind: 'uid',
    label: 'Founder',
    description: 'The founder named on the acknowledgments page.',
  },
  {
    id: 'team',
    kind: 'uidList',
    label: 'Our Team',
    description: 'The team listed on the acknowledgments page.',
  },
  {
    id: 'landing-hero',
    kind: 'video',
    label: 'Landing page hero',
    description: 'The video under the hero on the signed-in landing page.',
  },
  ...GUIDE_VIDEO_SLOTS,
] as const satisfies readonly SystemSlotDefinition[];

type SystemSlot = (typeof SYSTEM_SLOTS)[number];
export type SystemSlotId = SystemSlot['id'];
export type SystemVideoSlotId = Extract<SystemSlot, { kind: 'video' }>['id'];
export type SystemUidSlotId = Extract<SystemSlot, { kind: 'uid' }>['id'];
export type SystemUidListSlotId = Extract<SystemSlot, { kind: 'uidList' }>['id'];

function slotIdsOfKind<K extends SystemSlotKind>(kind: K) {
  const ids = SYSTEM_SLOTS.filter((slot) => slot.kind === kind).map((slot) => slot.id);
  return ids as unknown as [Extract<SystemSlot, { kind: K }>['id'], ...Extract<SystemSlot, { kind: K }>['id'][]];
}

export const SystemSlotIdSchema = z.enum(
  SYSTEM_SLOTS.map((slot) => slot.id) as unknown as [SystemSlotId, ...SystemSlotId[]],
);
export const SystemVideoSlotIdSchema = z.enum(slotIdsOfKind('video'));
export const SystemUidSlotIdSchema = z.enum(slotIdsOfKind('uid'));
export const SystemUidListSlotIdSchema = z.enum(slotIdsOfKind('uidList'));
/** A slot that names accounts: a `uid` or a `uidList` slot. */
export const SystemAccountSlotIdSchema = z.enum([
  ...SystemUidSlotIdSchema.options,
  ...SystemUidListSlotIdSchema.options,
]);
export type SystemAccountSlotId = z.infer<typeof SystemAccountSlotIdSchema>;

/** The registry entry for `id`, or undefined for an id the registry does not hold. */
export function getSystemSlot(id: string): SystemSlotDefinition | undefined {
  return SYSTEM_SLOTS.find((slot) => slot.id === id);
}
