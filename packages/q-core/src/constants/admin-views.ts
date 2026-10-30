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
