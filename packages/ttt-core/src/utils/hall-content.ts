import { checkTextField, type TextFieldDeclaration } from './text-field.js';
import {
  HALL_CONTENT_TEXT_FIELDS,
  HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE,
  HALL_SUB_ITEM_REQUIREMENT_LABELS,
} from '../constants/business-content.js';
import { HALL_CONTENT_CHANGE_REQUEST_INPUTS } from '../constants/text-fields.js';
import type { WorkProjectType } from '../types/content.js';
import {
  PublishedChapterSchema,
  PublishedTelevisionEpisodeSchema,
  PublishedTuneTrackSchema,
  type FullChapter,
  type FullTelevisionEpisode,
  type FullTuneTrack,
} from '../doc-schemas/content.js';
import { HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE } from '../paths/collections.js';

export const PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE = {
  Tales: {
    subcollection: HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE.Tales,
    schema: PublishedChapterSchema,
  },
  Tunes: {
    subcollection: HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE.Tunes,
    schema: PublishedTuneTrackSchema,
  },
  Television: {
    subcollection: HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE.Television,
    schema: PublishedTelevisionEpisodeSchema,
  },
} as const satisfies Record<WorkProjectType, { subcollection: string; schema: unknown }>;

export type HallContentTextFieldSurface = keyof typeof HALL_CONTENT_TEXT_FIELDS;

export type HallContentTextFieldsFor<S extends HallContentTextFieldSurface> = Partial<
  Record<(typeof HALL_CONTENT_TEXT_FIELDS)[S][number], string>
>;

export type HallContentTextFieldsValidation<S extends HallContentTextFieldSurface> =
  | { readonly ok: true; readonly fields: HallContentTextFieldsFor<S> }
  | { readonly ok: false; readonly reason: string };

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
    const declaration = (
      HALL_CONTENT_CHANGE_REQUEST_INPUTS[surface] as Record<string, TextFieldDeclaration>
    )[field];
    const result = checkTextField(declaration, typeof rawValue === 'string' ? rawValue : '');
    if (!result.ok) return { ok: false, reason: result.reason };
    normalized[field] = result.value;
  }

  if (Object.keys(normalized).length === 0) {
    return { ok: false, reason: 'No valid text fields proposed.' };
  }
  return { ok: true, fields: normalized as HallContentTextFieldsFor<S> };
}

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

export function isHallSubItemPublishable(
  workProjectType: WorkProjectType,
  subItem: Readonly<Record<string, unknown>>,
): boolean {
  return unmetHallSubItemRequirements(workProjectType, subItem).length === 0;
}

export type HallSubItemStatus = (FullChapter | FullTuneTrack | FullTelevisionEpisode)['status'];

export const HALL_SUB_ITEM_LOCKED_STATUSES = [
  'pending_approval',
  'published',
] as const satisfies readonly HallSubItemStatus[];

export function isHallSubItemLocked(status: unknown): boolean {
  return (HALL_SUB_ITEM_LOCKED_STATUSES as readonly unknown[]).includes(status);
}

export function hallContentChangeRequestTargetKey(
  hallItemId: string,
  subItemId?: string | null,
): string {
  return `${hallItemId}_${subItemId ?? 'detail'}`;
}

export function workRealmChangeRequestTargetKey(workRealmId: string): string {
  return `realm_${workRealmId}`;
}
