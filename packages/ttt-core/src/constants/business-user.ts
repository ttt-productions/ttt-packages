export const USERNAME_MIN_LENGTH = 3;

export const USERNAME_MAX_LENGTH = 20;

export const MAX_THEME_NAME_LENGTH = 50;

export const FORMER_MEMBER_DISPLAY_NAME = 'Former member';

export const ACCOUNT_DELETION_GRACE_DAYS = 30;

// UTF-16 code units, as HTML inputs and Firebase Auth count; Firebase Auth's floor is 6.
export const PASSWORD_MIN_LENGTH = 7;

export const PASSWORD_MAX_LENGTH = 64;

export const AGE_TEEN_FLOOR_YEARS = 13;

export const AGE_ADULT_FLOOR_YEARS = 18;

export const DATE_OF_BIRTH_MIN_YEAR = 1900;

export const DATE_OF_BIRTH_PART_DIGITS = { month: 2, day: 2, year: 4 } as const;

import { ACTIVE_LIMITS } from './app-mode.js';

export const CRAFT_SKILL_LIMIT = ACTIVE_LIMITS.user.maxCraftSkills;

export const MAX_OWNED_WORK_PROJECTS = ACTIVE_LIMITS.user.maxOwnedWorkProjects;

export const MAX_ASSOCIATED_WORK_PROJECTS = ACTIVE_LIMITS.user.maxAssociatedWorkProjects;

export const MAX_CRAFT_SKILL_TAGS = 5;

export const MAX_ARTISAN_LOCATION_LENGTH = 100;

export const MAX_HISTORY_ITEMS = 10;

export const SEARCH_RESULT_LIMIT = 6;

export const SITE_TOUR_CURRENT_VERSION = 1;
