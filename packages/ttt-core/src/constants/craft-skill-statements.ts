// ============================================================================
// CRAFT-SKILL ATTESTATION — the ONE home for the three-kind upload flow's
// statement version, VERBATIM agreement statements, kind labels/descriptions,
// picker order, and the refusal copy for a kind that is not available yet. The
// client displays these and the user must explicitly agree before the file
// picker unlocks; the backend records only `{ statementKind, statementVersion,
// agreedAt }` and validates the version against CRAFT_SKILL_STATEMENT_VERSION.
// ============================================================================

import type { CraftSkillKind } from '../doc-schemas/user.js';

/** Bump when any VERBATIM statement below changes; the version is recorded on every
 * craft-skill doc so we know which wording the user agreed to. */
export const CRAFT_SKILL_STATEMENT_VERSION = 1;

export const CRAFT_SKILL_KIND_LABELS: Record<CraftSkillKind, string> = {
  original: 'My own work',
  mimicOnTtt: 'Mimicked work from TTT Productions',
  mimicOffTtt: 'Mimicked work from outside TTT Productions',
};

/** One-line helper shown under each kind option in the picker. */
export const CRAFT_SKILL_KIND_DESCRIPTIONS: Record<CraftSkillKind, string> = {
  original: 'Entirely your own original creation.',
  mimicOnTtt: 'Your performance or recreation of another member’s TTT work (link the source).',
  mimicOffTtt: 'A cover or recreation of work from outside TTT (including public-domain works).',
};

export const CRAFT_SKILL_STATEMENTS: Record<CraftSkillKind, string> = {
  original:
    'I certify this craft skill is entirely my own original creation and I own all rights to it. No part of it copies or imitates another person’s work.',
  mimicOnTtt:
    'This craft skill is my performance or recreation of work created by a member of the TTT Productions community, shown here to demonstrate my abilities. I have linked the original artisan or work below. The original work belongs to its creator, and I claim no ownership of it.',
  mimicOffTtt:
    'This craft skill is my performance or recreation of a work that did not originate on TTT Productions (including public-domain or out-of-copyright works), shown only to demonstrate my abilities. The underlying work belongs to its owner, and I claim no ownership of it. I understand TTT Productions may remove this content at any time, including in response to a rights-holder request.',
};

export const CRAFT_SKILL_KIND_ORDER: CraftSkillKind[] = ['original', 'mimicOnTtt', 'mimicOffTtt'];

/**
 * Why "Mimicked work from outside TTT Productions" cannot be chosen yet: the picker shows it
 * when a person selects that kind, and the upload callable refuses the kind with the same words.
 */
export const CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE =
  "This option isn't available yet: sharing covers or recreations of work from outside TTT needs legal review first.";

/**
 * The ONE owner of which craft kinds are blocked at launch, with each one's refusal copy. A
 * blocked kind still renders in the picker (so people see it is coming) but selecting it stops
 * the flow with this copy, and the upload callable refuses it with the same words. Unblocking a
 * kind is removing its entry here.
 */
export const CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES = {
  mimicOffTtt: CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE,
} as const satisfies Partial<Record<CraftSkillKind, string>>;

/** A craft kind that is blocked at launch. */
export type BlockedCraftSkillKind = keyof typeof CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES;

/** Every craft kind blocked at launch — derived from the refusal copy, never restated. */
export const BLOCKED_CRAFT_SKILL_KINDS = Object.keys(
  CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES,
) as readonly BlockedCraftSkillKind[];

/** True when `kind` is blocked at launch; narrows it to index its refusal copy. */
export function isBlockedCraftSkillKind(kind: CraftSkillKind): kind is BlockedCraftSkillKind {
  return Object.prototype.hasOwnProperty.call(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES, kind);
}
