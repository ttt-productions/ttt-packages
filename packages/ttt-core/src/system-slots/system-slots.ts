// System slots: the admin-managed places the app shows a founder-recorded video or names a special
// account. Each surface is one registry entry; its value lives in Firestore and is set from the
// admin System Slots view, never in code.
//
// Every `uid` / `uidList` slot is PUBLIC data: its values are stored in the public `_appConfig`
// bucket, so a slot that names accounts is readable by anyone, signed in or not.

import { z } from 'zod';
import { GUIDE_VIDEO_DEFINITIONS, guideVideoSlotId } from './guide-videos.js';
import { HELP_VIDEO_DEFINITIONS, helpVideoSlotId } from './help-videos.js';

/** `video` holds one processed video; `uid` names one account; `uidList` names an ordered list. */
export const SystemSlotKindSchema = z.enum(['video', 'uid', 'uidList']);
export type SystemSlotKind = z.infer<typeof SystemSlotKindSchema>;

/**
 * Where a slot appears — the admin System Slots view groups slots by it, in this order, under these
 * names. A group is declared only once a slot belongs to it.
 */
export const SYSTEM_SLOT_GROUPS = [
  { id: 'landingPage', label: 'Landing page' },
  { id: 'acknowledgmentsPage', label: 'Acknowledgments page' },
  { id: 'backstageGuide', label: 'Backstage Guide' },
  { id: 'helpComponents', label: 'Help components' },
] as const;
export type SystemSlotGroupId = (typeof SYSTEM_SLOT_GROUPS)[number]['id'];

interface SystemSlotDefinitionBase {
  readonly id: string;
  /** The admin view's row title. */
  readonly label: string;
  /** Where the slot appears, in one sentence. */
  readonly description: string;
  readonly group: SystemSlotGroupId;
}

/**
 * A video slot declares whether its place always shows a video. `requiredVideo: true` reserves the
 * 16:9 box everywhere it is shown and holds the coming-soon placard until a video is uploaded;
 * `false` takes no space and shows nothing until a video is uploaded.
 */
export type SystemSlotDefinition =
  | (SystemSlotDefinitionBase & { readonly kind: 'video'; readonly requiredVideo: boolean })
  | (SystemSlotDefinitionBase & { readonly kind: 'uid' | 'uidList' });

const GUIDE_VIDEO_SLOTS = GUIDE_VIDEO_DEFINITIONS.map((video) => ({
  id: guideVideoSlotId(video.id),
  kind: 'video' as const,
  label: video.plannedTitle,
  description: 'A Backstage Guide video, shown wherever the Guide offers it.',
  group: 'backstageGuide' as const,
  requiredVideo: true,
}));

const HELP_VIDEO_SLOTS = HELP_VIDEO_DEFINITIONS.map((help) => ({
  id: helpVideoSlotId(help.id),
  kind: 'video' as const,
  label: help.title,
  description: help.location,
  group: 'helpComponents' as const,
  requiredVideo: false,
}));

export const SYSTEM_SLOTS = [
  {
    id: 'founder',
    kind: 'uid',
    label: 'Founder',
    description: 'The founder named on the acknowledgments page.',
    group: 'acknowledgmentsPage',
  },
  {
    id: 'team',
    kind: 'uidList',
    label: 'Our Team',
    description: 'The team listed on the acknowledgments page.',
    group: 'acknowledgmentsPage',
  },
  {
    id: 'landing-hero',
    kind: 'video',
    label: 'Landing page hero',
    description: 'The video under the hero on the signed-in landing page.',
    group: 'landingPage',
    requiredVideo: true,
  },
  ...GUIDE_VIDEO_SLOTS,
  ...HELP_VIDEO_SLOTS,
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

/** Whether a video slot's place always shows a video (its box and placard) — read from the registry. */
export function isRequiredVideoSlot(slotId: SystemVideoSlotId): boolean {
  const slot = SYSTEM_SLOTS.find((entry) => entry.id === slotId);
  return slot?.kind === 'video' && slot.requiredVideo;
}

/** The registry's slots under each group, in the groups' order; a group no slot belongs to is left out. */
export function systemSlotsByGroup(): Array<{ group: (typeof SYSTEM_SLOT_GROUPS)[number]; slots: SystemSlot[] }> {
  return SYSTEM_SLOT_GROUPS.map((group) => ({
    group,
    slots: SYSTEM_SLOTS.filter((slot) => slot.group === group.id),
  })).filter((entry) => entry.slots.length > 0);
}
