/**
 * The custom claims an admin account carries (value `true`). The claim is a fast check only: every
 * server-side admin decision — a Cloud Function and the Firestore and Storage rules alike — also
 * requires the account on the live admin roster (`_systemData/adminList`), so a removed admin loses
 * access at once.
 */
export const ADMIN_CLAIM = 'isAdmin';

/**
 * The custom claim a junior admin account carries (value `true`), synced from the live admin
 * roster's junior admin list. No rules file reads it, and the backend grants it nothing while junior
 * admin is switched off there.
 */
export const JR_ADMIN_CLAIM = 'isJrAdmin';
