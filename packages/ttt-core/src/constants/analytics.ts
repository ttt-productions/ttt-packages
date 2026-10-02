// The one declaration of the analytics events the app logs. The app's analytics hook takes only
// these names, so an event cannot be logged without being declared here.
export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'sign_up',
  'become_artisan_creator',
  'project_created',
  'project_startup',
  'content_uploaded',
  'commission_proposal_submitted',
  'audition_voted',
  'payment_page_view',
  'pledge_payment_initiated',
  'pledge_payment_completed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
