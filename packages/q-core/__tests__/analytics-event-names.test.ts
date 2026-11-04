import { describe, it, expect, expectTypeOf } from 'vitest';
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName } from '../src/constants/analytics.js';

describe('analytics event names', () => {
  it('are the events the app logs: page views, sign-up and login, scoring, and joining', () => {
    expect([...ANALYTICS_EVENT_NAMES].sort()).toEqual([
      'free_agent_signed_up',
      'free_agent_withdrawn',
      'game_finalized',
      'ghost_linked',
      'login',
      'page_view',
      'sign_up',
      'stat_recorded',
      'team_joined',
    ]);
  });

  it('each name is declared once', () => {
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(ANALYTICS_EVENT_NAMES.length);
  });

  it('an event name outside the declaration is not an AnalyticsEventName', () => {
    expectTypeOf<'game_finalized'>().toMatchTypeOf<AnalyticsEventName>();
    // @ts-expect-error — a name the app does not log is not an analytics event.
    const undeclared: AnalyticsEventName = 'purchase';
    void undeclared;
  });
});
