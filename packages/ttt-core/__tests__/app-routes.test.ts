import { describe, it, expect } from 'vitest';
import { APP_ROUTES } from '../src/paths/app-routes.js';
import { HALL_BROWSE_DEFAULTS, HALL_BROWSE_VIEW_MODES } from '../src/paths/hall-browse.js';
import { ReportableItemTypeSchema } from '../src/doc-schemas/safety/foundation.js';
import {
  HALL_LIBRARY_SORT_OPTIONS,
  HALL_WING_TYPES,
  WORK_PROJECT_TYPES,
} from '../src/constants/options.js';

describe('app routes with ids or query parameters', () => {
  it('a short link opens under /v', () => {
    expect(APP_ROUTES.shortLink('abc123')).toBe('/v/abc123');
  });

  it('the landing page opens plainly, or replays the site tour', () => {
    expect(APP_ROUTES.landing()).toBe('/landing');
    expect(APP_ROUTES.landing('replay')).toBe('/landing?tour=replay');
  });

  it("the email-action page receives Firebase's query verbatim", () => {
    expect(APP_ROUTES.authAction()).toBe('/auth/action');
    expect(APP_ROUTES.authAction('')).toBe('/auth/action');
    expect(APP_ROUTES.authAction('mode=verifyEmail&oobCode=abc')).toBe(
      '/auth/action?mode=verifyEmail&oobCode=abc',
    );
  });

  it('a payment success return lands on the success page', () => {
    expect(APP_ROUTES.paymentSuccess()).toBe('/payment/success');
  });

  it('a payment success return carries its checkout session id unencoded', () => {
    expect(APP_ROUTES.paymentSuccess('cs_test_1')).toBe('/payment/success?session_id=cs_test_1');
    expect(APP_ROUTES.paymentSuccess('{CHECKOUT_SESSION_ID}')).toBe(
      '/payment/success?session_id={CHECKOUT_SESSION_ID}',
    );
  });

  it('a cancelled payment returns to the payment page marked cancelled', () => {
    expect(APP_ROUTES.paymentCancel()).toBe('/payment?status=cancel');
  });

  it('an audition opens on its own page', () => {
    expect(APP_ROUTES.audition('a1')).toBe('/audition/a1');
  });

  it("an audition entry opens on its audition's page, naming the entry", () => {
    expect(APP_ROUTES.auditionEntry('a1', 'e1')).toBe('/audition/a1?auditionEntryId=e1');
  });

  it('a commission opens on its listing page', () => {
    expect(APP_ROUTES.commission('c1')).toBe('/commission/c1');
  });

  it('a Hall item opens in the Hall library, optionally on one of its items', () => {
    expect(APP_ROUTES.hallItem('h1')).toBe('/hall-library/h1');
    expect(APP_ROUTES.hallItem('h1', { item: 'ch2' })).toBe('/hall-library/h1?item=ch2');
  });

  it('a Hall item carries the browse state it was opened from, then its item', () => {
    const browse = {
      filters: { workProjectType: 'Tunes', hallWingType: 'entertainment', sortBy: 'newest' },
      viewMode: 'list',
    } as const;
    expect(APP_ROUTES.hallItem('h1', { browse })).toBe(
      '/hall-library/h1?workProjectType=Tunes&view=list',
    );
    expect(APP_ROUTES.hallItem('h1', { browse, item: 'ch2' })).toBe(
      '/hall-library/h1?workProjectType=Tunes&view=list&item=ch2',
    );
    expect(APP_ROUTES.hallItem('h1', { browse: HALL_BROWSE_DEFAULTS })).toBe('/hall-library/h1');
  });

  it('the Hall library opens plainly, or on a browse state with its defaults left out', () => {
    expect(APP_ROUTES.hallLibrary()).toBe('/hall-library');
    expect(APP_ROUTES.hallLibrary(HALL_BROWSE_DEFAULTS)).toBe('/hall-library');
    expect(
      APP_ROUTES.hallLibrary({
        filters: { workProjectType: 'All', hallWingType: 'educational', sortBy: 'oldest' },
        viewMode: 'grid',
      }),
    ).toBe('/hall-library?workProjectType=All&hallWingType=educational&sortBy=oldest');
  });

  it('the admin area opens on its dashboard, or on one named view', () => {
    expect(APP_ROUTES.admin()).toBe('/admin');
    expect(APP_ROUTES.admin('dashboard')).toBe('/admin');
    expect(APP_ROUTES.admin('userReports')).toBe('/admin?view=userReports');
  });

  it('the Backstage Guide opens on its start, or on one topic', () => {
    expect(APP_ROUTES.backstageGuide()).toBe('/backstage-guide');
    expect(APP_ROUTES.backstageGuide('find-your-way-around')).toBe(
      '/backstage-guide?topic=find-your-way-around',
    );
  });

  it("a profile opens the member's own corner, or another member's profile", () => {
    expect(APP_ROUTES.profile()).toBe('/profile');
    expect(APP_ROUTES.profile('u1')).toBe('/profile/u1');
  });

  it('a Work and a Realm open on their own pages', () => {
    expect(APP_ROUTES.workProject('wp1')).toBe('/work-projects/wp1');
    expect(APP_ROUTES.workRealm('r1')).toBe('/work-realms/r1');
  });

  it('the take-it-down page opens plainly, or as an in-app report of one item', () => {
    expect(APP_ROUTES.takeItDown()).toBe('/take-it-down');
    expect(APP_ROUTES.takeItDown({ itemType: 'square-streetz-post', itemId: 'p1' })).toBe(
      '/take-it-down?mode=inapp&itemType=square-streetz-post&itemId=p1',
    );
    expect(
      APP_ROUTES.takeItDown({ itemType: 'audition-entry', itemId: 'e1', parentItemId: 'a1' }),
    ).toBe('/take-it-down?mode=inapp&itemType=audition-entry&itemId=e1&parentItemId=a1');
  });
});

describe('app routes with a fixed path', () => {
  const fixed: readonly (readonly [() => string, string])[] = [
    [APP_ROUTES.home, '/'],
    [APP_ROUTES.login, '/login'],
    [APP_ROUTES.register, '/register'],
    [APP_ROUTES.forgotPassword, '/forgot-password'],
    [APP_ROUTES.authVerify, '/auth/verify'],
    [APP_ROUTES.firebaseConfigError, '/firebase-config-error'],
    [APP_ROUTES.payment, '/payment'],
    [APP_ROUTES.auditionBoard, '/audition-board'],
    [APP_ROUTES.commissionBoard, '/commission-board'],
    [APP_ROUTES.hallLibrary, '/hall-library'],
    [APP_ROUTES.squareStreetz, '/square-streetz'],
    [APP_ROUTES.craftFair, '/craft-fair'],
    [APP_ROUTES.greenRoom, '/green-room'],
    [APP_ROUTES.playbill, '/playbill'],
    [APP_ROUTES.patrons, '/patrons'],
    [APP_ROUTES.invites, '/invites'],
    [APP_ROUTES.messages, '/messages'],
    [APP_ROUTES.settings, '/settings'],
    [APP_ROUTES.themes, '/themes'],
    [APP_ROUTES.backstageGuide, '/backstage-guide'],
    [APP_ROUTES.admin, '/admin'],
    [APP_ROUTES.profileUploads, '/profile/uploads'],
    [APP_ROUTES.profileResetDisplayName, '/profile/reset-display-name'],
    [APP_ROUTES.workProjects, '/work-projects'],
    [APP_ROUTES.workProjectNew, '/work-projects/new'],
    [APP_ROUTES.acknowledgments, '/acknowledgments'],
    [APP_ROUTES.aiUsage, '/ai-usage'],
    [APP_ROUTES.attributions, '/attributions'],
    [APP_ROUTES.dmca, '/dmca'],
    [APP_ROUTES.futurePlans, '/future-plans'],
    [APP_ROUTES.privacy, '/privacy'],
    [APP_ROUTES.rulesAndAgreements, '/rules-and-agreements'],
    [APP_ROUTES.terms, '/terms'],
  ];

  it.each(fixed)('opens its page (%#)', (build, path) => {
    expect(build()).toBe(path);
  });
});

describe('app route values are URL-safe', () => {
  it('an id with a reserved character comes out encoded, in a path and in a query', () => {
    expect(APP_ROUTES.workProject('a/b?c')).toBe('/work-projects/a%2Fb%3Fc');
    expect(APP_ROUTES.shortLink('x#y')).toBe('/v/x%23y');
    expect(APP_ROUTES.auditionEntry('a&1', 'e=2')).toBe('/audition/a%261?auditionEntryId=e%3D2');
    expect(APP_ROUTES.hallItem('h 1', { item: 'c&2' })).toBe('/hall-library/h%201?item=c%262');
    expect(
      APP_ROUTES.takeItDown({ itemType: 'audition-entry', itemId: 'e&1', parentItemId: 'a/1' }),
    ).toBe('/take-it-down?mode=inapp&itemType=audition-entry&itemId=e%261&parentItemId=a%2F1');
  });

  it("Stripe's session-id template comes out verbatim", () => {
    expect(APP_ROUTES.paymentSuccess('{CHECKOUT_SESSION_ID}')).toBe(
      '/payment/success?session_id={CHECKOUT_SESSION_ID}',
    );
  });

  it('every enum value a route writes raw needs no URL encoding', () => {
    const rawValues = [
      ...ReportableItemTypeSchema.options,
      ...Object.keys(WORK_PROJECT_TYPES),
      ...Object.keys(HALL_WING_TYPES),
      ...Object.keys(HALL_LIBRARY_SORT_OPTIONS),
      ...HALL_BROWSE_VIEW_MODES,
      'All',
    ];
    for (const value of rawValues) {
      expect(encodeURIComponent(value), value).toBe(value);
    }
  });
});
