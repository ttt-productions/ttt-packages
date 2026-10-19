// The first-visit site tour: every step highlights a different permanent shell control, and every
// line is spoken by a member of the Company.

import { describe, it, expect } from 'vitest';
import {
  COMPANY_MASCOT_ORDER,
  SITE_TOUR_ANCHORS,
  SITE_TOUR_CURTAIN_CALL_LINES,
  SITE_TOUR_INVITATION_LINES,
  SITE_TOUR_STEPS,
  SITE_TOUR_TOTAL_STEPS,
} from '../src/constants/company-mascots.js';

describe('site tour copy', () => {
  it('visits each shell control exactly once, in its step order', () => {
    expect(SITE_TOUR_STEPS.map((step) => step.anchor)).toEqual([...SITE_TOUR_ANCHORS]);
    expect(SITE_TOUR_TOTAL_STEPS).toBe(SITE_TOUR_ANCHORS.length);
  });

  it('every line and step is spoken by a Company mascot', () => {
    const speakers = [
      ...SITE_TOUR_INVITATION_LINES,
      ...SITE_TOUR_STEPS,
      ...SITE_TOUR_CURTAIN_CALL_LINES,
    ].map((l) => l.speaker);
    for (const speaker of speakers) expect(COMPANY_MASCOT_ORDER).toContain(speaker);
  });
});
