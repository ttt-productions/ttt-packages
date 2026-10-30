// The admin area's views. The admin area is one page, and each view is chosen by its `?view=` slug;
// the dashboard is the bare page. Both roots link into a view, so the slugs are declared here once.

export const ADMIN_VIEWS = [
  'dashboard',
  'leagues',
  'people',
  'stats',
  'setup',
  'migration',
] as const;

export type AdminView = (typeof ADMIN_VIEWS)[number];
