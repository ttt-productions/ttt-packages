import type { ReportableItemType } from '../doc-schemas/safety/foundation.js';
import type { AdminView } from '../constants/admin-views.js';
import type { BackstageGuideTopicId } from '../constants/backstage-guide-topics.js';
import {
  HALL_LIBRARY_QUERY_KEYS,
  hallBrowseQueryEntries,
  type HallBrowseState,
} from './hall-browse.js';

export interface TakeItDownInAppTarget {
  readonly itemType: ReportableItemType;
  readonly itemId: string;
  readonly parentItemId?: string;
}

export interface HallItemRouteOptions {
  readonly item?: string;
  readonly browse?: HallBrowseState;
}

const enc = encodeURIComponent;

function withQuery(path: string, entries: readonly (readonly [string, string])[]): string {
  if (entries.length === 0) return path;
  return `${path}?${entries.map(([key, value]) => `${key}=${value}`).join('&')}`;
}

export const APP_ROUTES = {
  home: (): string => '/',
  landing: (tour?: 'replay'): string => (tour === undefined ? '/landing' : `/landing?tour=${tour}`),
  login: (): string => '/login',
  register: (): string => '/register',
  forgotPassword: (): string => '/forgot-password',
  authAction: (firebaseQuery?: string): string =>
    firebaseQuery === undefined || firebaseQuery === ''
      ? '/auth/action'
      : `/auth/action?${firebaseQuery}`,
  authVerify: (): string => '/auth/verify',
  firebaseConfigError: (): string => '/firebase-config-error',
  shortLink: (shortId: string): string => `/v/${enc(shortId)}`,
  payment: (): string => '/payment',
  paymentSuccess: (sessionId?: string): string =>
    sessionId === undefined ? '/payment/success' : `/payment/success?session_id=${sessionId}`,
  paymentCancel: (): string => '/payment?status=cancel',
  auditionBoard: (): string => '/audition-board',
  audition: (auditionId: string): string => `/audition/${enc(auditionId)}`,
  auditionEntry: (auditionId: string, auditionEntryId: string): string =>
    `/audition/${enc(auditionId)}?auditionEntryId=${enc(auditionEntryId)}`,
  commissionBoard: (): string => '/commission-board',
  commission: (commissionListingId: string): string => `/commission/${enc(commissionListingId)}`,
  hallLibrary: (browse?: HallBrowseState): string =>
    withQuery('/hall-library', browse === undefined ? [] : hallBrowseQueryEntries(browse)),
  hallItem: (hallItemId: string, options: HallItemRouteOptions = {}): string =>
    withQuery(`/hall-library/${enc(hallItemId)}`, [
      ...(options.browse === undefined ? [] : hallBrowseQueryEntries(options.browse)),
      ...(options.item === undefined
        ? []
        : [[HALL_LIBRARY_QUERY_KEYS.item, enc(options.item)] as const]),
    ]),
  squareStreetz: (): string => '/square-streetz',
  craftFair: (): string => '/craft-fair',
  greenRoom: (): string => '/green-room',
  playbill: (): string => '/playbill',
  patrons: (): string => '/patrons',
  invites: (): string => '/invites',
  messages: (): string => '/messages',
  settings: (): string => '/settings',
  themes: (): string => '/themes',
  backstageGuide: (topic?: BackstageGuideTopicId): string =>
    topic === undefined ? '/backstage-guide' : `/backstage-guide?topic=${topic}`,
  admin: (view?: AdminView): string =>
    view === undefined || view === 'dashboard' ? '/admin' : `/admin?view=${view}`,
  profile: (userId?: string): string =>
    userId === undefined ? '/profile' : `/profile/${enc(userId)}`,
  profileUploads: (): string => '/profile/uploads',
  profileResetDisplayName: (): string => '/profile/reset-display-name',
  workProjects: (): string => '/work-projects',
  workProjectNew: (): string => '/work-projects/new',
  workProject: (workProjectId: string): string => `/work-projects/${enc(workProjectId)}`,
  workRealm: (workRealmId: string): string => `/work-realms/${enc(workRealmId)}`,
  takeItDown: (inApp?: TakeItDownInAppTarget): string => {
    if (inApp === undefined) return '/take-it-down';
    const parent =
      inApp.parentItemId === undefined ? '' : `&parentItemId=${enc(inApp.parentItemId)}`;
    return `/take-it-down?mode=inapp&itemType=${inApp.itemType}&itemId=${enc(inApp.itemId)}${parent}`;
  },
  acknowledgments: (): string => '/acknowledgments',
  aiUsage: (): string => '/ai-usage',
  attributions: (): string => '/attributions',
  dmca: (): string => '/dmca',
  futurePlans: (): string => '/future-plans',
  privacy: (): string => '/privacy',
  rulesAndAgreements: (): string => '/rules-and-agreements',
  terms: (): string => '/terms',
} as const;
