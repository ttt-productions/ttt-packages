// Content-surface business-rule constants — commissions, auditions, the social
// feed, and messaging.
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  MAX_CHAPTER_CONTENT_LENGTH,
  MAX_WORK_REALM_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
} from "./business-work-project.js";
import { ACTIVE_LIMITS } from './app-mode.js';
import { HALL_LIBRARY_TARGET_FIELDS } from '../media/hall-library-target-fields.js';
import type { WorkProjectType } from '../types/content.js';
import { HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE } from './hall-content-routing.js';
export {
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE,
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
  type HallContentDetailSurface,
  type HallContentSubItemSurface,
} from './hall-content-routing.js';

/** The maximum character length for a SquareStreetz post created on behalf of a workProject. */
export const MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH = 150;

// --- Commission Board & Proposals ---

/** Maximum number of open commissions a workProject can have. Mode-varied. */
export const MAX_COMMISSION_LISTINGS = ACTIVE_LIMITS.workProject.maxCommissionListings;

/** Maximum number of proposal artisans saved to a commission. */
export const MAX_SAVED_PROPOSAL_ARTISANS = 5;

/** Maximum length for a commission title. */
export const MAX_COMMISSION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a commission description / cover letter. */
export const MAX_COMMISSION_DESCRIPTION_LENGTH = 400;

// --- Moderation text-clear + published hall-content text fields ---

/**
 * Neutral placeholder written into a single cleared text field by the moderation
 * text-clear remedy. Canonical wording — the backend `runModerationClearText`
 * core writes exactly this string; a wording change is a single edit here.
 */
export const MODERATION_CLEAR_PLACEHOLDER =
  'Removed by moderation — awaiting an update by the steward.';

/**
 * Default REASON strings recorded on a moderation action when the admin supplies no
 * user-facing reason. Distinct from MODERATION_CLEAR_PLACEHOLDER (which is written INTO
 * cleared content fields) — these are the recorded justification text. Canonical wording;
 * consumers (resolveAdminTask's forceRetitle / chat-delete actions) never inline them.
 */
export const MODERATION_DEFAULT_REMOVAL_REASON = 'Removed by moderation.';
export const MODERATION_DEFAULT_RETITLE_REASON = 'Title/description removed by moderation.';

/**
 * CANONICAL clearable text-field map for the per-field moderation TEXT-CLEAR remedy.
 * Cross-boundary single owner: the admin field-picker offers this set per surface and
 * the backend clear runner validates + normalizes caller-supplied fields against it.
 * Keys are surfaces; values are the exact document field names (NOT display labels)
 * recorded verbatim in `moderationClearedFields`. Covers every clearable surface —
 * workProject/workRealm shell metadata, hall parent details (tale/tune/television),
 * and hall sub-items (chapter/track/episode).
 */
export const MODERATION_CLEARABLE_TEXT_FIELDS = {
  // workProject + workRealm shell metadata
  workProject: ['workingTitle', 'workingDescription'],
  workRealm: ['workingTitle', 'workingDescription'],
  // hall content parent details
  tale: ['title', 'description'],
  tune: ['title', 'description'],
  television: ['title', 'description'],
  // hall content sub-items
  chapter: ['title', 'content'],
  tuneTrack: ['title', 'description'],
  televisionEpisode: ['title', 'description'],
} as const satisfies Record<string, readonly string[]>;

/** A surface whose text fields the moderation clear remedy can neutralize. */
export type ModerationClearableSurface = keyof typeof MODERATION_CLEARABLE_TEXT_FIELDS;

/**
 * Every DISTINCT clearable/changeable text-field NAME, DERIVED from the canonical
 * MODERATION_CLEARABLE_TEXT_FIELDS map (the union of every surface's tuple). Label maps and
 * per-field cap maps key on this instead of `string`, so adding a field to a surface is a
 * compile error until its label and cap exist.
 */
export type ClearableTextFieldName =
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS)[ModerationClearableSurface][number];

/**
 * The bounded computed-field portion of a moderation text-clear write. Writers
 * may only set one of the canonical clearable field names, never an arbitrary
 * document key. Sentinel-bearing moderation metadata stays runtime-specific.
 */
export type ModerationClearTextFieldPatch = {
  [Field in ClearableTextFieldName]?: string;
};

/**
 * The DISTINCT clearable text-field NAMES across the whole hall content family (tale/tune/
 * television detail → title/description; chapter → title/content; track/episode →
 * title/description). DERIVED from the canonical MODERATION_CLEARABLE_TEXT_FIELDS map — the
 * union of every hall surface's fields — so the `clearHallContentText` callable's field-enum
 * (`HallClearFieldSchema`) never restates the `title`/`description`/`content` literals. Index
 * access on the map's readonly tuples preserves the literal types, so this stays a typed
 * `readonly ['title','description','content']` a `z.enum(...)` can consume directly.
 */
export const HALL_CLEARABLE_TEXT_FIELD_NAMES = [
  MODERATION_CLEARABLE_TEXT_FIELDS.tale[0], // title
  MODERATION_CLEARABLE_TEXT_FIELDS.tale[1], // description
  MODERATION_CLEARABLE_TEXT_FIELDS.chapter[1], // content
] as const;

/**
 * The raw doc field names each published hall-content surface exposes as changeable TEXT.
 * Cross-boundary: the member "Update details" field picker offers this set per surface and
 * the change-request submit runner validates against it. Detail surfaces (tale/tune/
 * television) live on the hall parent doc; sub-item surfaces on the published chapter/
 * track/episode doc. This is the HALL-SURFACE SUBSET of the canonical
 * MODERATION_CLEARABLE_TEXT_FIELDS above (it excludes the `workProject` shell) — every
 * tuple is projected from that one owner, so the two can never drift.
 */
export const HALL_CONTENT_TEXT_FIELDS = {
  tale: MODERATION_CLEARABLE_TEXT_FIELDS.tale,
  tune: MODERATION_CLEARABLE_TEXT_FIELDS.tune,
  television: MODERATION_CLEARABLE_TEXT_FIELDS.television,
  chapter: MODERATION_CLEARABLE_TEXT_FIELDS.chapter,
  tuneTrack: MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack,
  televisionEpisode: MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode,
  // Realm grain (R1, 2026-07-12): targets the `workRealms/{id}` doc directly.
  workRealm: MODERATION_CLEARABLE_TEXT_FIELDS.workRealm,
} as const satisfies Record<string, readonly string[]>;

/** Per-field max lengths for proposed hall-content text. DERIVED from the owning
 *  constants — never independent numbers — so the change-request pipeline can never
 *  drift from the authoring limits again (the pre-2026-07-13 copy carried its own
 *  200/5000/100000 set while authoring enforced 150/300/2500). Keyed on the derived
 *  ClearableTextFieldName union, so a new clearable field fails the build here until
 *  it has a cap. */
export const HALL_CONTENT_TEXT_FIELD_MAX = {
  title: MAX_WORK_PROJECT_TITLE_LENGTH,
  description: MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  content: MAX_CHAPTER_CONTENT_LENGTH,
  workingTitle: MAX_WORK_REALM_TITLE_LENGTH,
  workingDescription: MAX_WORK_REALM_DESCRIPTION_LENGTH,
} as const satisfies Record<ClearableTextFieldName, number>;

/** One work-project type's two hall text surfaces — the published DETAIL on the hall parent
 *  and its chapter/track/episode SUB-ITEM — each with the clearable/changeable field tuple
 *  that surface exposes. */
export interface HallContentSurfaceRouting {
  /** Surface identity of the hall parent DETAIL (tale / tune / television). */
  detailSurface: ModerationClearableSurface;
  /** The DETAIL surface's clearable text fields. */
  detailFields: readonly ClearableTextFieldName[];
  /** Surface identity of the SUB-ITEM (chapter / tuneTrack / televisionEpisode). */
  subItemSurface: ModerationClearableSurface;
  /** The SUB-ITEM surface's clearable text fields — a Tale chapter carries title/content, a
   *  Tune track and a Television episode title/description. */
  subItemFields: readonly ClearableTextFieldName[];
}

/**
 * WorkProjectType → hall text-surface routing. Surface identities project from the lower-level
 * `HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE` owner; this map adds the clearable field tuples each
 * surface exposes. Cross-boundary: the backend text-clear and change-request
 * runners resolve `surface` from (workProjectType, is-sub-item?) through this map, and the admin
 * field pickers project their checkbox options from the same entry — three sites that each
 * hand-rolled the routing before (a ternary that fell through to the tuneTrack tuple for
 * Television, silently correct only because the two tuples happen to match today).
 *
 * Every identity and field tuple is PROJECTED from its canonical owner — no surface or field
 * literal is restated here — and the `satisfies Record<WorkProjectType, …>` makes adding a
 * work-project type a compile error until its surfaces are routed.
 */
export const HALL_CONTENT_SURFACES_BY_WORK_TYPE = {
  Tales: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.tale,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.chapter,
  },
  Tunes: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.tune,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack,
  },
  Television: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.television,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode,
  },
} as const satisfies Record<WorkProjectType, HallContentSurfaceRouting>;

/**
 * Work-shell text field → the field it appears as on the PUBLISHED hall parent
 * (`PublishedHallItem`): a Work's `workingTitle` is the hall item's `title`, its
 * `workingDescription` the hall item's `description`. The moderation placeholder writers
 * dual-write the shell and its published projection through a COMPUTED key, so the mapping
 * has to be a closed const map whose values are declared `PublishedHallItem` keys rather than
 * an inline ternary over two string literals. Both sides are projected from the canonical
 * clearable-field map, so neither name is restated here.
 */
export const WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD = {
  [MODERATION_CLEARABLE_TEXT_FIELDS.workProject[0]]: MODERATION_CLEARABLE_TEXT_FIELDS.tale[0], // workingTitle → title
  [MODERATION_CLEARABLE_TEXT_FIELDS.workProject[1]]: MODERATION_CLEARABLE_TEXT_FIELDS.tale[1], // workingDescription → description
} as const satisfies Record<
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.workProject)[number],
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.tale)[number]
>;

// --- Hall sub-item publish requirements ---

/**
 * CANONICAL per-work-type rule for what a Tale chapter / Tune track / Television episode must
 * carry before it may be submitted, approved, or published. ONE owner for the member-side
 * eligibility filter, the submit core, the approve core, and the publish core — each of which
 * otherwise restates the same three-way branch (ENG-002 / ENG-005).
 *
 * Every type requires a non-empty `title` and `photoAssetId`; a Tale chapter additionally
 * requires its `content`, a Tune track its audio, a Television episode its video. The media
 * field names are PROJECTED from the canonical upload target-field map and the text field names
 * from the clearable-field map, so no field literal is restated. These are exactly the fields
 * the published sub-item schemas (`PublishedChapter` / `PublishedTuneTrack` /
 * `PublishedTelevisionEpisode`) declare as REQUIRED.
 */
export const HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE = {
  Tales: [
    MODERATION_CLEARABLE_TEXT_FIELDS.chapter[0], // title
    HALL_LIBRARY_TARGET_FIELDS['chapter-photo'], // photoAssetId
    MODERATION_CLEARABLE_TEXT_FIELDS.chapter[1], // content
  ],
  Tunes: [
    MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack[0], // title
    HALL_LIBRARY_TARGET_FIELDS['tune-track-photo'], // photoAssetId
    HALL_LIBRARY_TARGET_FIELDS['tune-track-audio'], // audioAssetId
  ],
  Television: [
    MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode[0], // title
    HALL_LIBRARY_TARGET_FIELDS['television-episode-photo'], // photoAssetId
    HALL_LIBRARY_TARGET_FIELDS['television-episode-video'], // videoAssetId
  ],
} as const satisfies Record<WorkProjectType, readonly string[]>;

/** A field name some work type requires on a publishable hall sub-item. */
export type HallSubItemRequiredField =
  (typeof HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE)[WorkProjectType][number];

/**
 * User-facing wording for each required sub-item field, used when a surface has to say what is
 * still missing. Keyed on the derived union, so a new requirement fails the build until it has
 * wording.
 */
export const HALL_SUB_ITEM_REQUIREMENT_LABELS = {
  title: 'a title',
  content: 'chapter text',
  photoAssetId: 'a picture',
  audioAssetId: 'an audio file',
  videoAssetId: 'a video file',
} as const satisfies Record<HallSubItemRequiredField, string>;

/** Admin decision reason on a published change request (required on a deny; shown to
 *  the member). One owner for the review callable schema AND the admin work-view input. */
export const MAX_HALL_CHANGE_REQUEST_REASON_LENGTH = 2000;

// --- Real-people / parody disclaimer (R3, 2026-07-12) ---

/**
 * The ONE standard platform disclaimer rendered on every published work whose
 * author attested it depicts real people (parody / satire / commentary). Two
 * layers, always shown together (DJ, 2026-07-12): the themed playbill HEADER
 * on top, the plain legal MESSAGE underneath. There is no free-text disclaimer
 * anywhere — these constants are the only wording, so a wording change is a
 * single edit here (display surfaces and any backend consumer read these; the
 * text is never persisted on docs). The MESSAGE deliberately never ADMITS the
 * work depicts real people — it hedges ("even those based on real people",
 * the standard film-boilerplate move) so the disclaimer never hands over the
 * depiction element of a claim. Legal wording pending counsel confirmation
 * (tracked in docs/ttt-prod-legal/).
 */
export const REAL_PEOPLE_DISCLAIMER_HEADER =
  'A Notice from the Management: the faces may be familiar, but the players are pure ' +
  'invention — parody and satire, in the grand old tradition of the stage.';

export const REAL_PEOPLE_DISCLAIMER_MESSAGE =
  'All characters, statements, and events in this work, even those based on real people, ' +
  'are entirely fictional and are presented as parody, satire, or commentary. Any voices, ' +
  'likenesses, or portrayals of real people are impersonated or fictionalized, and nothing ' +
  'in this work should be understood as a statement of fact about, or as speech by, any ' +
  'real person. This work is not created by, affiliated with, sponsored by, or endorsed by ' +
  'any real person portrayed or referenced in it.';

// --- Hall library per-user viewing-state doc (hall-viewing-experience Area 2, ruled 2026-07-04) ---

/**
 * Caps for the per-user Hall viewing-state doc (`HallLibraryPreferencesSchema`,
 * `userProfiles/{uid}/privateData/hallLibraryPreferences`). Every list on that doc is
 * capped for launch — no unbounded per-user lists. `hiddenWorkIds`/`inkedWorkIds` are
 * oldest-pruned (or the write is rejected with a friendly message once full);
 * `inProgress` is LRU-pruned by `updatedAt`; `recentlyViewed` is capped, newest-kept.
 * Enforcement lives in the backend core (`runX`) that owns this doc — this is the
 * shared source of truth for the cap values themselves.
 */
export const HALL_LIBRARY_PREFS_CAPS = {
  hiddenWorkIds: 200,
  inkedWorkIds: 200,
  inProgress: 50,
  recentlyViewed: 20,
} as const satisfies Record<string, number>;

// --- Auditions ---

/** Maximum length for an audition title. */
export const MAX_AUDITION_TITLE_LENGTH = 150;

/** Curated-audition option-video batch bounds (the fixed 2..8 option count carried
 * from the Create click through targetInfo/upload-variables to the create core's
 * re-check). ONE declaration — every `.min()/.max()` derives from these. */
export const MIN_CURATED_AUDITION_OPTIONS = 2;
export const MAX_CURATED_AUDITION_OPTIONS = 8;

/** Maximum length for an audition description. */
export const MAX_AUDITION_DESCRIPTION_LENGTH = 1000;

/**
 * Maximum sponsored-audition payout amount in whole USD accepted at the upload
 * trust boundary. Mirrors MAX_PLEDGE_PAYMENT_AMOUNT_CENTS ($500,000) expressed
 * in dollars — a finite ceiling that rejects absurd/garbage amounts before any
 * downstream processing.
 */
export const MAX_SPONSORED_AUDITION_AMOUNT_USD = 500_000;

/**
 * The one user-facing rejection sentence when a Work's own active guildmate tries to enter
 * that Work's open audition (entries exist to recruit OUTSIDERS; a member can't be
 * recruited). Shared by both backend enforcement points (upload-accept and publish) — it is
 * the `failed-precondition` answer text the entry UI renders verbatim.
 */
export const GUILDMATE_AUDITION_ENTRY_REJECTION =
  'You are already a guildmate of this Work — its audition is for recruiting new collaborators.';

// --- SquareStreetz (Social Feed) ---

/** Maximum length for a SquareStreetz post. */
export const MAX_POST_LENGTH = 500;

/** Maximum number of mentions allowed in a single SquareStreetz post. */
export const MAX_MENTIONS = 3;

/** Maximum characters of a mention's display name shown before truncation. */
export const MAX_MENTION_DISPLAY_LENGTH = 30;

// --- Messages & Invites ---

/** Maximum length for a guild-invite message. */
export const MAX_GUILD_INVITE_MESSAGE_LENGTH = 500;

/** Maximum length for a pledgePayment message. */
export const MAX_PLEDGE_PAYMENT_MESSAGE_LENGTH = 500;
