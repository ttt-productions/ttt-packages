export type ReportCoreTaskErrorCode =
  'not-found' | 'failed-precondition' | 'permission-denied' | 'invalid-argument' | 'aborted';

export class ReportCoreTaskError extends Error {
  readonly code: ReportCoreTaskErrorCode;

  constructor(code: ReportCoreTaskErrorCode, message: string) {
    super(message);
    this.name = 'ReportCoreTaskError';
    this.code = code;
  }
}
