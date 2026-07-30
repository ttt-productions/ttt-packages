// Canonical user-facing reason picklist + label helper (ARCH-102): the ONE home for the guided
// resolution flow's user-facing reason options, moved out of the app so every client renders the
// same codes + labels.

import { describe, it, expect } from 'vitest';
import {
  USER_FACING_REASON_OPTIONS,
  userFacingReasonLabel,
  FEEDBACK_TYPE_LABELS,
  WORK_PROJECT_TYPE_RULE_GROUP_TITLE,
  HALL_WING_TYPE_RULE_GROUP_TITLE,
  CLEARABLE_TEXT_FIELD_LABELS,
  CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES,
  clearableTextFieldLabel,
  type ClearableTextFieldLabelOverrides,
} from '../src/constants/admin-labels';
import { FEEDBACK_TYPES } from '../src/constants/business-admin';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  HALL_CONTENT_TEXT_FIELDS,
} from '../src/constants/business-content';
import { HallContentTextSurfaceSchema } from '../src/doc-schemas/content';

describe('USER_FACING_REASON_OPTIONS', () => {
  it('carries the full canonical code set', () => {
    expect(USER_FACING_REASON_OPTIONS.map((o) => o.code)).toEqual([
      'harassment',
      'hate',
      'adult-content',
      'violence',
      'spam',
      'impersonation',
      'ip',
      'nonconsensual',
      'safety',
      'other',
    ]);
  });

  it('every option has a non-empty label and description', () => {
    for (const option of USER_FACING_REASON_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });
});

describe('userFacingReasonLabel', () => {
  it('returns the label for a known code', () => {
    expect(userFacingReasonLabel('harassment')).toBe('Harassment or bullying');
    expect(userFacingReasonLabel('nonconsensual')).toBe('Nonconsensual intimate imagery');
    expect(userFacingReasonLabel('other')).toBe('Other (explain)');
  });

  it('returns undefined for an unknown or absent code', () => {
    expect(userFacingReasonLabel('does-not-exist')).toBeUndefined();
    expect(userFacingReasonLabel(undefined)).toBeUndefined();
  });
});

describe('FEEDBACK_TYPE_LABELS', () => {
  it('is Record-complete over FEEDBACK_TYPES', () => {
    expect(Object.keys(FEEDBACK_TYPE_LABELS).sort()).toEqual([...FEEDBACK_TYPES].sort());
  });

  it('renders the settled short terms, never the compound code identifiers', () => {
    expect(FEEDBACK_TYPE_LABELS.tradeProfessionSuggestions).toBe('Trades');
    expect(FEEDBACK_TYPE_LABELS.craftSkillTagSuggestions).toBe('Craft Tags');
    expect(FEEDBACK_TYPE_LABELS.talesWorkGenreSuggestions).toBe('Tales Genres');
    expect(FEEDBACK_TYPE_LABELS.tunesWorkGenreSuggestions).toBe('Tunes Genres');
    expect(FEEDBACK_TYPE_LABELS.televisionWorkGenreSuggestions).toBe('Television Genres');
  });

  it('leaks no retired vocabulary into user-facing copy', () => {
    // "Trade Professions" / "Craft Skills" / "Work Genres" are CODE identifiers; user-facing
    // copy uses Trade / Craft / Genre (terminology-naming-convention.md, ARCH-107).
    const retired = ['profession', 'skill', 'category', 'work genre'];
    for (const label of Object.values(FEEDBACK_TYPE_LABELS)) {
      for (const word of retired) {
        expect(label.toLowerCase(), `'${word}' appears in '${label}'`).not.toContain(word);
      }
    }
  });
});

describe('CLEARABLE_TEXT_FIELD_LABELS', () => {
  it('is Record-complete over every clearable field name the canonical map declares', () => {
    const declared = new Set(
      Object.values(MODERATION_CLEARABLE_TEXT_FIELDS).flatMap((fields) => [...fields]),
    );
    expect(Object.keys(CLEARABLE_TEXT_FIELD_LABELS).sort()).toEqual([...declared].sort());
  });

  it('carries the settled short display terms for every field name', () => {
    expect(CLEARABLE_TEXT_FIELD_LABELS.title).toBe('Title');
    expect(CLEARABLE_TEXT_FIELD_LABELS.description).toBe('Description');
    expect(CLEARABLE_TEXT_FIELD_LABELS.content).toBe('Content');
    // The Work-shell / Realm pair: the `working` prefix is a CODE identifier only (ARCH-107).
    expect(CLEARABLE_TEXT_FIELD_LABELS.workingTitle).toBe('Title');
    expect(CLEARABLE_TEXT_FIELD_LABELS.workingDescription).toBe('Description');
  });

  it('never leaks a raw doc field name into a rendered label', () => {
    for (const [field, label] of Object.entries(CLEARABLE_TEXT_FIELD_LABELS)) {
      expect(label.length, `${field} has no label`).toBeGreaterThan(0);
      expect(label.toLowerCase(), `'${field}' leaks its code identifier`).not.toContain('working');
    }
  });
});

describe('CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES', () => {
  it('overrides only canonical hall-content text surfaces', () => {
    for (const surface of Object.keys(CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES)) {
      expect(HallContentTextSurfaceSchema.safeParse(surface).success).toBe(true);
    }
  });

  it('overrides only fields the overridden surface actually exposes', () => {
    const owner = HALL_CONTENT_TEXT_FIELDS as Record<string, readonly string[]>;
    for (const [surface, fields] of Object.entries(CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES)) {
      for (const field of Object.keys(fields)) {
        expect(owner[surface], `${surface} is not a field-map surface`).toBeDefined();
        expect(owner[surface], `${surface} does not expose ${field}`).toContain(field);
      }
    }
  });

  it('keeps the override surface key space identical to HallContentTextSurface', () => {
    // The override TYPE is a mapped type over HallContentTextSurface indexed into
    // HALL_CONTENT_TEXT_FIELDS, so the two key sets diverging is a compile error at the type's
    // declaration. This pins the runtime side of that invariant.
    expect(Object.keys(HALL_CONTENT_TEXT_FIELDS).sort()).toEqual(
      [...HallContentTextSurfaceSchema.options].sort(),
    );
  });

  it('carries the settled Realm term (DJ ruling: a Realm has a Name, not a Title)', () => {
    expect(CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES.workRealm.workingTitle).toBe('Name');
  });

  it('compile assertions: a valid surface/field pair types, the map is assignable to its type', () => {
    const valid: ClearableTextFieldLabelOverrides = { workRealm: { workingDescription: 'About' } };
    expect(valid.workRealm?.workingDescription).toBe('About');
    // `chapter` exposes title/content only — `{ chapter: { workingTitle: … } }` and any surface
    // outside HallContentTextSurface both fail to compile against this type.
    const chapterOverride: ClearableTextFieldLabelOverrides = { chapter: { content: 'Body' } };
    expect(chapterOverride.chapter?.content).toBe('Body');
    const asType: ClearableTextFieldLabelOverrides = CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES;
    expect(asType.workRealm?.workingTitle).toBe('Name');
  });
});

describe('clearableTextFieldLabel', () => {
  it('returns the base label for every known field name when no surface is given', () => {
    for (const [field, label] of Object.entries(CLEARABLE_TEXT_FIELD_LABELS)) {
      expect(clearableTextFieldLabel(field)).toBe(label);
    }
  });

  it('resolves the Realm override: workRealm.workingTitle is "Name"', () => {
    expect(clearableTextFieldLabel('workingTitle', 'workRealm')).toBe('Name');
  });

  it('falls back to the base label for every non-overridden surface/field pair', () => {
    const overrides = CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES as Record<
      string,
      Record<string, string> | undefined
    >;
    let checked = 0;
    for (const [surface, fields] of Object.entries(HALL_CONTENT_TEXT_FIELDS)) {
      for (const field of fields) {
        if (overrides[surface]?.[field] !== undefined) continue;
        expect(
          clearableTextFieldLabel(field, surface),
          `${surface}.${field} should use the base label`,
        ).toBe(CLEARABLE_TEXT_FIELD_LABELS[field]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('falls back to the base label for the workProject shell (a clearable, non-hall surface)', () => {
    // `workProject` is a MODERATION_CLEARABLE_TEXT_FIELDS surface but not a
    // HallContentTextSurface, so it has no overrides — a Work's workingTitle is still a Title.
    for (const field of MODERATION_CLEARABLE_TEXT_FIELDS.workProject) {
      expect(clearableTextFieldLabel(field, 'workProject')).toBe(CLEARABLE_TEXT_FIELD_LABELS[field]);
    }
    expect(clearableTextFieldLabel('workingTitle', 'workProject')).toBe('Title');
  });

  it('ignores an unknown surface rather than losing the label', () => {
    expect(clearableTextFieldLabel('workingTitle', 'notASurface')).toBe('Title');
  });

  it('falls back to the raw name for an unknown field, with or without a surface', () => {
    // Callers pass field names read off stored docs (`moderationClearedFields`), so an
    // unrecognized legacy name must render as itself rather than blank.
    expect(clearableTextFieldLabel('someLegacyField')).toBe('someLegacyField');
    expect(clearableTextFieldLabel('someLegacyField', 'workRealm')).toBe('someLegacyField');
  });
});

describe('rules-surface group titles', () => {
  it('are the canonical headings both rules surfaces render', () => {
    expect(WORK_PROJECT_TYPE_RULE_GROUP_TITLE).toBe('Work Type Rules');
    expect(HALL_WING_TYPE_RULE_GROUP_TITLE).toBe('Hall Wing Rules');
  });
});
