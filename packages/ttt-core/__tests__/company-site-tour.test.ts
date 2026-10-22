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

  it('Bill opens the tour by welcoming the member as Curtainfolk', () => {
    expect(SITE_TOUR_INVITATION_LINES[0]).toEqual({
      speaker: 'bill',
      text: 'Welcome to TTT, Curtainfolk! Before the curtain rises, may we show you the few controls that will help you find your way around?',
    });
  });

  it('the account-area stop shows every member the same copy', () => {
    const accountArea = SITE_TOUR_STEPS.find((step) => step.anchor === 'accountArea');
    expect(accountArea?.body).toEqual([
      'Use it to visit The Town, open Your Corner, change settings, or sign out.',
    ]);
    expect(accountArea).not.toHaveProperty('bodyNonArtisanFinal');
  });
});
