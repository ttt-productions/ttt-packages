/**
 * Typed failure channel for the admin-task queue handlers.
 *
 * Every EXPECTED precondition outcome (missing task, checkout conflict, empty
 * queue, admin gate, transaction contention) throws a ReportCoreTaskError whose
 * `code` is deliberately the matching `HttpsError` code string, so a consuming
 * Cloud Function callable maps it 1:1:
 *
 *   catch (err) {
 *     if (err instanceof ReportCoreTaskError) throw new HttpsError(err.code, err.message);
 *     throw err;
 *   }
 *
 * Before this, the handlers threw plain `Error`s, which `onCall` surfaces as
 * HTTP 500 'internal' — an ordinary answered collision ("already checked out by
 * another admin") reached clients as a server error and Sentry as crash noise.
 * report-core stays generic: it never imports firebase-functions; the consumer
 * owns the HttpsError construction.
 */
export type ReportCoreTaskErrorCode =
  | 'not-found'
  | 'failed-precondition'
  | 'permission-denied'
  | 'invalid-argument'
  | 'aborted';

export class ReportCoreTaskError extends Error {
  readonly code: ReportCoreTaskErrorCode;

  constructor(code: ReportCoreTaskErrorCode, message: string) {
    super(message);
    this.name = 'ReportCoreTaskError';
    this.code = code;
  }
}
