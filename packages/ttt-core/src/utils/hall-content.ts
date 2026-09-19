// Pure hall-content rules shared by the member surfaces and the backend cores that own the
// writes. Server-safe: constants and plain functions only.

import {
  HALL_CONTENT_TEXT_FIELDS,
  HALL_CONTENT_TEXT_FIELD_MAX,
  HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE,
  HALL_SUB_ITEM_REQUIREMENT_LABELS,
} from '../constants/business-content.js';
import type { WorkProjectType } from '../types/content.js';

/** A published hall-content surface whose text a change request or the moderation
 *  text-clear remedy can target. */
export type HallContentTextFieldSurface = keyof typeof HALL_CONTENT_TEXT_FIELDS;

/** The proposed-text map a given surface accepts: only that surface's own field names. */
export type HallContentTextFieldsFor<S extends HallContentTextFieldSurface> =
  Partial<Record<(typeof HALL_CONTENT_TEXT_FIELDS)[S][number], string>>;

export type HallContentTextFieldsValidation<S extends HallContentTextFieldSurface> =
  | { readonly ok: true; readonly fields: HallContentTextFieldsFor<S> }
  | { readonly ok: false; readonly reason: string };

/**
 * The ONE strict per-surface check for a proposed hall-content text map: every key must be a
 * field that surface owns, every value a trimmed non-empty string within that field's cap. The
 * stored `hallContentChangeRequests` shape is a flat field map with the request's own `surface`
 * as the single authoritative discriminator, so this is where the allowlist is enforced — at the
 * backend boundary, before the map is persisted or written onto a published doc.
 *
 * Both the allowlist and the caps come from the canonical Hall text-field maps; there is no
 * second allowlist anywhere.
 *
 * @returns the normalized (trimmed) field map, or the user-facing reason it was rejected.
 */
export function validateHallContentTextFields<S extends HallContentTextFieldSurface>(
  surface: S,
  proposedFields: Readonly<Record<string, unknown>>,
): HallContentTextFieldsValidation<S> {
  const allowed = HALL_CONTENT_TEXT_FIELDS[surface] as readonly string[];
  const normalized: Record<string, string> = {};

  for (const [field, rawValue] of Object.entries(proposedFields)) {
    if (!allowed.includes(field)) {
      return { ok: false, reason: `Field "${field}" is not editable on this item.` };
    }
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (value.length === 0) {
      return { ok: false, reason: `Field "${field}" cannot be empty.` };
    }
    const max = HALL_CONTENT_TEXT_FIELD_MAX[field as keyof typeof HALL_CONTENT_TEXT_FIELD_MAX];
    if (value.length > max) {
      return { ok: false, reason: `Field "${field}" exceeds the maximum length of ${max}.` };
    }
    normalized[field] = value;
  }

  if (Object.keys(normalized).length === 0) {
    return { ok: false, reason: 'No valid text fields proposed.' };
  }
  return { ok: true, fields: normalized as HallContentTextFieldsFor<S> };
}

/**
 * The requirements a Tale chapter / Tune track / Television episode has not met yet, as the
 * wording a surface can show, in the canonical field order. Empty means the sub-item may be
 * submitted, approved, and published.
 *
 * ONE owner for the member-side eligibility filter and all three backend cores — none of them
 * restates the per-type branch.
 */
export function unmetHallSubItemRequirements(
  workProjectType: WorkProjectType,
  subItem: Readonly<Record<string, unknown>>,
): string[] {
  const required = HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE[workProjectType];
  return required
    .filter((field) => {
      const value = subItem[field];
      return typeof value !== 'string' || value.trim().length === 0;
    })
    .map((field) => HALL_SUB_ITEM_REQUIREMENT_LABELS[field]);
}

/** True when the sub-item meets every requirement its work type imposes. */
export function isHallSubItemPublishable(
  workProjectType: WorkProjectType,
  subItem: Readonly<Record<string, unknown>>,
): boolean {
  return unmetHallSubItemRequirements(workProjectType, subItem).length === 0;
}
