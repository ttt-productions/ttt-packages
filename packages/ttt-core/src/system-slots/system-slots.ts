// Every `uid` / `uidList` slot is public: its values live in `_appConfig`, readable signed out.

import { z } from 'zod';
import { GUIDE_VIDEO_DEFINITIONS, guideVideoSlotId } from './guide-videos.js';
import { HELP_VIDEO_DEFINITIONS, helpVideoSlotId } from './help-videos.js';
import { RULE_GROUP_KEYS, type RuleGroup } from '../types/content.js';
import { ARTISAN_AGREEMENTS_TITLE, RULE_GROUP_TITLES } from '../constants/admin-labels.js';

export const SystemSlotKindSchema = z.enum(['video', 'uid', 'uidList']);
export type SystemSlotKind = z.infer<typeof SystemSlotKindSchema>;

export const SYSTEM_SLOT_GROUPS = [
  { id: 'landingPage', label: 'Landing page' },
  { id: 'acknowledgmentsPage', label: 'Acknowledgments page' },
  { id: 'backstageGuide', label: 'Backstage Guide' },
  { id: 'helpComponents', label: 'Help components' },
  { id: 'futurePlansPage', label: 'Future Plans page' },
  { id: 'rulesPage', label: 'Rules & Agreements page' },
] as const;
export type SystemSlotGroupId = (typeof SYSTEM_SLOT_GROUPS)[number]['id'];

interface SystemSlotDefinitionBase {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly group: SystemSlotGroupId;
}

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

const RULE_GROUP_SLOT_SUFFIXES = {
  generic: 'general',
  merchandising: 'merchandising',
  hallWing: 'hall-wing',
  workRealm: 'realm',
} as const satisfies Record<RuleGroup, string>;

export function ruleGroupVideoSlotId<G extends RuleGroup>(
  group: G,
): `rules-${(typeof RULE_GROUP_SLOT_SUFFIXES)[G]}` {
  return `rules-${RULE_GROUP_SLOT_SUFFIXES[group]}`;
}

const RULE_GROUP_VIDEO_SLOTS = RULE_GROUP_KEYS.map((group) => ({
  id: ruleGroupVideoSlotId(group),
  kind: 'video' as const,
  label: RULE_GROUP_TITLES[group],
  description: `The video under the ${RULE_GROUP_TITLES[group]} heading on the Rules & Agreements page.`,
  group: 'rulesPage' as const,
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
  {
    id: 'future-plans-page',
    kind: 'video',
    label: 'Future Plans',
    description: 'The video under the intro on the Future Plans page.',
    group: 'futurePlansPage',
    requiredVideo: false,
  },
  {
    id: 'rules-page',
    kind: 'video',
    label: 'Rules & Agreements',
    description: 'The video under the intro on the Rules & Agreements page.',
    group: 'rulesPage',
    requiredVideo: false,
  },
  ...RULE_GROUP_VIDEO_SLOTS,
  {
    id: 'rules-artisan-agreements',
    kind: 'video',
    label: ARTISAN_AGREEMENTS_TITLE,
    description: 'The video under the Artisan Agreements heading on the Rules & Agreements page.',
    group: 'rulesPage',
    requiredVideo: false,
  },
] as const satisfies readonly SystemSlotDefinition[];

type SystemSlot = (typeof SYSTEM_SLOTS)[number];
export type SystemSlotId = SystemSlot['id'];
export type SystemVideoSlotId = Extract<SystemSlot, { kind: 'video' }>['id'];
export type SystemUidSlotId = Extract<SystemSlot, { kind: 'uid' }>['id'];
export type SystemUidListSlotId = Extract<SystemSlot, { kind: 'uidList' }>['id'];

function slotIdsOfKind<K extends SystemSlotKind>(kind: K) {
  const ids = SYSTEM_SLOTS.filter((slot) => slot.kind === kind).map((slot) => slot.id);
  return ids as unknown as [
    Extract<SystemSlot, { kind: K }>['id'],
    ...Extract<SystemSlot, { kind: K }>['id'][],
  ];
}

export const SystemSlotIdSchema = z.enum(
  SYSTEM_SLOTS.map((slot) => slot.id) as unknown as [SystemSlotId, ...SystemSlotId[]],
);
export const SystemVideoSlotIdSchema = z.enum(slotIdsOfKind('video'));
export const SystemUidSlotIdSchema = z.enum(slotIdsOfKind('uid'));
export const SystemUidListSlotIdSchema = z.enum(slotIdsOfKind('uidList'));
export const SystemAccountSlotIdSchema = z.enum([
  ...SystemUidSlotIdSchema.options,
  ...SystemUidListSlotIdSchema.options,
]);
export type SystemAccountSlotId = z.infer<typeof SystemAccountSlotIdSchema>;

export function getSystemSlot(id: string): SystemSlotDefinition | undefined {
  return SYSTEM_SLOTS.find((slot) => slot.id === id);
}

export function isRequiredVideoSlot(slotId: SystemVideoSlotId): boolean {
  const slot = SYSTEM_SLOTS.find((entry) => entry.id === slotId);
  return slot?.kind === 'video' && slot.requiredVideo;
}

export function systemSlotsByGroup(): Array<{
  group: (typeof SYSTEM_SLOT_GROUPS)[number];
  slots: SystemSlot[];
}> {
  return SYSTEM_SLOT_GROUPS.map((group) => ({
    group,
    slots: SYSTEM_SLOTS.filter((slot) => slot.group === group.id),
  })).filter((entry) => entry.slots.length > 0);
}
