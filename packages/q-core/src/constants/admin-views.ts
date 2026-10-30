// The admin area's views. The admin area is one page, and each view is chosen by its `?view=` slug;
// the dashboard is the bare page. Every screen is its own view, listed once in the admin sidebar, so
// both roots link straight to it; the slugs are declared here once.

export const ADMIN_VIEWS = [
  'dashboard',
  'leagues',
  'users',
  'roles',
  'hardware',
  'statsReports',
  'fixStats',
  'landingPage',
  'appConfig',
  'gameLocations',
  'waiverTemplates',
  'awards',
  'capacityLimits',
  'migration',
] as const;

export type AdminView = (typeof ADMIN_VIEWS)[number];
