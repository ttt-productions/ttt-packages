import type { CraftSkillKind } from '../doc-schemas/user.js';

// Bump when any statement below changes; each craft-skill doc records the version agreed to.
export const CRAFT_SKILL_STATEMENT_VERSION = 3;

export const CRAFT_SKILL_KIND_LABELS: Record<CraftSkillKind, string> = {
  original: 'My own work',
  mimicOnTtt: 'Mimicked work from TTT Productions',
  mimicOffTtt: 'Mimicked work from outside TTT Productions',
};

export const CRAFT_SKILL_KIND_DESCRIPTIONS: Record<CraftSkillKind, string> = {
  original: 'Entirely your own original creation.',
  mimicOnTtt: 'Your performance or recreation of another member’s TTT work (link the source).',
  mimicOffTtt: 'A cover or recreation of work from outside TTT (including public-domain works).',
};

export const CRAFT_SKILL_STATEMENTS: Record<CraftSkillKind, string> = {
  original:
    'I certify this craft is entirely my own original creation and I own all rights to it. No part of it copies or imitates another person’s work. It stays mine: TTT only hosts and shows it here, and never sells, licenses, or gives it to anyone else.',
  mimicOnTtt:
    'This craft is my performance or recreation of work created by a member of the TTT Productions community, shown here to demonstrate my abilities. I have linked the original artisan or work below. The original belongs to its creator — or, if it’s a published Work, is held by TTT in stewardship — and I claim no ownership of it. I won’t make money from this mimic outside TTT.',
  mimicOffTtt:
    'This craft is my performance or recreation of a work that did not originate on TTT Productions (including public-domain or out-of-copyright works), shown only to demonstrate my abilities. The underlying work belongs to its owner, and I claim no ownership of it. I understand TTT Productions may remove this content at any time, including in response to a rights-holder request.',
};

export const CRAFT_SKILL_KIND_ORDER: CraftSkillKind[] = ['original', 'mimicOnTtt', 'mimicOffTtt'];

export const CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE =
  "This option isn't allowed yet. Sharing covers or recreations of work from outside TTT stays off until I've talked with a lawyer and gotten approval.";

export const CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES = {
  mimicOffTtt: CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE,
} as const satisfies Partial<Record<CraftSkillKind, string>>;

export type BlockedCraftSkillKind = keyof typeof CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES;

export const BLOCKED_CRAFT_SKILL_KINDS = Object.keys(
  CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES,
) as readonly BlockedCraftSkillKind[];

export function isBlockedCraftSkillKind(kind: CraftSkillKind): kind is BlockedCraftSkillKind {
  return Object.prototype.hasOwnProperty.call(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES, kind);
}
