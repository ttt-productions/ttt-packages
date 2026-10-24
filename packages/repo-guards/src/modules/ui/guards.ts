import type { GenericGuardDefinition } from '../../node/suite/config.js';
import {
  accessibleControlsGuard,
  wholeInputNumbersGuard,
  type AccessibleControlFacts,
  type WholeInputNumberFacts,
} from './accessibility.js';
import {
  stylesheetEntryGuard,
  tailwindSourcesGuard,
  themeTokensGuard,
  utilityCollisionGuard,
  type StylesheetEntryFacts,
  type TailwindSourceFacts,
  type ThemeTokenFacts,
} from './cascade.js';
import {
  enumLabelsGuard,
  schemaBoundsGuard,
  textEntryGuard,
  type EnumLabelFacts,
  type SchemaBoundFacts,
  type TextEntryFacts,
} from './definitions.js';
import {
  layoutOrderGuard,
  loadingFeedbackGuard,
  navigationGuard,
  pendingNameSeatGuard,
  showMoreGuard,
  type LayoutOrderFacts,
  type LoadingFeedbackFacts,
  type NavigationFacts,
  type PendingNameSeatFacts,
  type ShowMoreFacts,
} from './interaction.js';
import { selfHostedFontsGuard } from './fonts.js';
import { motionGuard, type MotionFacts } from './motion.js';
import {
  colorLiteralsGuard,
  scaleClassesGuard,
  shadowOwnershipGuard,
  stackRowsGuard,
  statusForegroundGuard,
  unavailableAffordanceGuard,
  type ColorLiteralFacts,
  type EntryStylesheetFacts,
} from './styling.js';
import { sharedTruncationGuard, type SharedTruncationFacts } from './truncation.js';

export type UiGuardFacts = {
  colorLiterals: ColorLiteralFacts;
  themeScaleClasses: EntryStylesheetFacts;
  tailwindSources: TailwindSourceFacts;
  stylesheetEntry: StylesheetEntryFacts;
  themeTokens: ThemeTokenFacts;
  motionTokens: MotionFacts;
  shadowOwnership: Record<string, never>;
  statusForegroundOnFill: Record<string, never>;
  semanticTextCollision: EntryStylesheetFacts;
  stackOnRows: Record<string, never>;
  unavailableControlAffordance: Record<string, never>;
  navigationHelper: NavigationFacts;
  loadingFeedback: LoadingFeedbackFacts;
  rootLayoutOrder: LayoutOrderFacts;
  showMoreToggle: ShowMoreFacts;
  enumLabels: EnumLabelFacts;
  textEntryBoxes: TextEntryFacts;
  schemaBounds: SchemaBoundFacts;
  pendingNameSeat: PendingNameSeatFacts;
  accessibleControls: AccessibleControlFacts;
  wholeInputNumbers: WholeInputNumberFacts;
  selfHostedFonts: Record<string, never>;
  sharedTruncation: SharedTruncationFacts;
};

export const UI_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  colorLiteralsGuard,
  scaleClassesGuard,
  tailwindSourcesGuard,
  stylesheetEntryGuard,
  themeTokensGuard,
  motionGuard,
  shadowOwnershipGuard,
  statusForegroundGuard,
  utilityCollisionGuard,
  stackRowsGuard,
  unavailableAffordanceGuard,
  navigationGuard,
  loadingFeedbackGuard,
  layoutOrderGuard,
  showMoreGuard,
  enumLabelsGuard,
  textEntryGuard,
  schemaBoundsGuard,
  pendingNameSeatGuard,
  accessibleControlsGuard,
  wholeInputNumbersGuard,
  selfHostedFontsGuard,
  sharedTruncationGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
