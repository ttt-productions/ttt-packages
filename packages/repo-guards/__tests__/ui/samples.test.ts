// Every ui guard that carries samples proves its matcher with them, and every guard the area
// registers takes its facts under its own id.

import { describe, expect, it } from 'vitest';
import { UI_GUARDS, type UiGuardFacts } from '../../src/modules/ui/guards.js';
import { checkSamples } from '../../src/suite/run.js';

const entryStylesheet = 'src/app/styles/globals.css';
const FACTS: UiGuardFacts = {
  colorLiterals: { exceptions: [] },
  themeScaleClasses: { entryStylesheet },
  tailwindSources: { entryStylesheet, manifest: 'package.json', packageScopes: ['@kit/'] },
  stylesheetEntry: { layoutModule: 'src/app/layout.tsx', entryStylesheet, pinnedOrder: ['@import "tailwindcss"'] },
  themeTokens: { entryStylesheet, tokenSheet: 'src/app/styles/brand.css' },
  motionTokens: { entryStylesheet, motionHelper: 'src/motion.ts', focusedInputKeeperAdapter: 'src/mobile.ts' },
  shadowOwnership: {},
  statusForegroundOnFill: {},
  semanticTextCollision: { entryStylesheet },
  stackOnRows: {},
  unavailableControlAffordance: {},
  navigationHelper: { helper: 'src/nav.tsx', helperExports: ['AppLink'], guardedNavigationOwner: 'src/nav.tsx' },
  loadingFeedback: { pullToRefreshWrapper: 'src/pull.tsx', hookWideFlags: [{ hook: 'useFunctions', flag: 'isLoading', readers: [] }] },
  rootLayoutOrder: { layoutModule: 'src/app/layout.tsx', mountedOnce: ['Shell'], wraps: [], outside: [], precedes: [] },
  showMoreToggle: { toggle: 'ShowMoreToggle' },
  enumLabels: { fieldNames: ['status', 'kind'], exceptions: [] },
  textEntryBoxes: { reviewed: [] },
  schemaBounds: { exceptions: [] },
  pendingNameSeat: { seat: 'src/seat.tsx' },
};

describe('the ui area', () => {
  it('accepts a complete set of facts for every guard it registers', () => {
    expect(UI_GUARDS.map((d) => d.id).sort()).toEqual(Object.keys(FACTS).sort());
    for (const definition of UI_GUARDS) expect(definition.factProblems(FACTS[definition.id as keyof UiGuardFacts] as never), definition.id).toEqual([]);
  });

  it('runs every guard everywhere: none may be declared absent', () => {
    expect(UI_GUARDS.filter((d) => d.absentWhen !== false).map((d) => d.id)).toEqual([]);
  });

  it("proves every sampled matcher: each must-fail sample hits and each must-pass sample does not", () => {
    for (const definition of UI_GUARDS) {
      for (const guard of definition.build(FACTS[definition.id as keyof UiGuardFacts] as never)) checkSamples(guard);
    }
  });
});
