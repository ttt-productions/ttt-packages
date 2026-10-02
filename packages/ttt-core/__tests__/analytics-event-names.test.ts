import { describe, it, expect, expectTypeOf } from 'vitest';
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName } from '../src/constants';

describe('analytics event names', () => {
  it('are the events the app logs: page views, sign-up, the creator funnel, and the payment funnel', () => {
    expect([...ANALYTICS_EVENT_NAMES].sort()).toEqual([
      'audition_voted',
      'become_artisan_creator',
      'commission_proposal_submitted',
      'content_uploaded',
      'page_view',
      'payment_page_view',
      'pledge_payment_completed',
      'pledge_payment_initiated',
      'project_created',
      'project_startup',
      'sign_up',
    ]);
  });

  it('each name is declared once', () => {
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(ANALYTICS_EVENT_NAMES.length);
  });

  it('an event name outside the declaration is not an AnalyticsEventName', () => {
    expectTypeOf<'pledge_payment_completed'>().toMatchTypeOf<AnalyticsEventName>();
    // @ts-expect-error — a name the app does not log is not an analytics event.
    const undeclared: AnalyticsEventName = 'purchase';
    void undeclared;
  });
});
