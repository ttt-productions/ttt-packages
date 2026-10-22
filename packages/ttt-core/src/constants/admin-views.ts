export const ADMIN_VIEWS = [
  'dashboard',
  'safetyCaseConsole',
  'thresholdLibraryReview',
  'hallContentChangeRequests',
  'userReports',
  'contentAppeals',
  'userMessages',
  'userManagement',
  'auditionMngt',
  'feedbackMngt',
  'announcements',
  'publicDocuments',
  'systemSlots',
  'profanityList',
  'siteVitals',
  'opsStatus',
  'opsRepairs',
  'shortLinks',
  'readyForLaunch',
] as const;

export type AdminView = (typeof ADMIN_VIEWS)[number];
