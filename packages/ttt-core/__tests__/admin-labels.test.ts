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
  clearableTextFieldLabel,
} from '../src/constants/admin-labels';
import { FEEDBACK_TYPES } from '../src/constants/business-admin';
import { MODERATION_CLEARABLE_TEXT_FIELDS } from '../src/constants/business-content';

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

describe('clearableTextFieldLabel', () => {
  it('returns the label for every known field name', () => {
    for (const [field, label] of Object.entries(CLEARABLE_TEXT_FIELD_LABELS)) {
      expect(clearableTextFieldLabel(field)).toBe(label);
    }
  });

  it('falls back to the raw name for an unknown field', () => {
    // Callers pass field names read off stored docs (`moderationClearedFields`), so an
    // unrecognized legacy name must render as itself rather than blank.
    expect(clearableTextFieldLabel('someLegacyField')).toBe('someLegacyField');
  });
});

describe('rules-surface group titles', () => {
  it('are the canonical headings both rules surfaces render', () => {
    expect(WORK_PROJECT_TYPE_RULE_GROUP_TITLE).toBe('Work Type Rules');
    expect(HALL_WING_TYPE_RULE_GROUP_TITLE).toBe('Hall Wing Rules');
  });
});
