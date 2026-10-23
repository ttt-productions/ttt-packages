import { describe, it, expect } from 'vitest';
import { ADMIN_VIEWS, FULL_ADMIN_ONLY_VIEWS } from '../src/constants/admin-views.js';
import { BACKSTAGE_GUIDE_TOPIC_IDS } from '../src/constants/backstage-guide-topics.js';
import { APP_ROUTES } from '../src/paths/app-routes.js';

describe('admin views', () => {
  it('the dashboard is a view, and it is the plain admin URL', () => {
    expect(ADMIN_VIEWS).toContain('dashboard');
    expect(APP_ROUTES.admin('dashboard')).toBe(APP_ROUTES.admin());
  });

  it('every view needs no URL encoding, and a view opens its own admin URL', () => {
    for (const view of ADMIN_VIEWS) {
      expect(encodeURIComponent(view)).toBe(view);
    }
    expect(APP_ROUTES.admin('safetyCaseConsole')).toBe('/admin?view=safetyCaseConsole');
  });
  it('only the safety console, public documents, and system slots need full admin; the dashboard never does', () => {
    expect([...FULL_ADMIN_ONLY_VIEWS].sort()).toEqual(
      ['publicDocuments', 'safetyCaseConsole', 'systemSlots'].sort(),
    );
    expect(FULL_ADMIN_ONLY_VIEWS).not.toContain('dashboard');
  });
});

describe('Backstage Guide topics', () => {
  it('every topic has its own guide URL, and an id that needs no URL encoding', () => {
    for (const topic of BACKSTAGE_GUIDE_TOPIC_IDS) {
      expect(encodeURIComponent(topic)).toBe(topic);
    }
    const urls = BACKSTAGE_GUIDE_TOPIC_IDS.map((topic) => APP_ROUTES.backstageGuide(topic));
    expect(new Set(urls).size).toBe(BACKSTAGE_GUIDE_TOPIC_IDS.length);
  });
});
