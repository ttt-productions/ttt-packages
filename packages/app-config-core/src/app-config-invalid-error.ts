export type AppConfigProblem = 'missing-document' | 'invalid-setting' | 'invalid-update';

function messageFor(
  path: string,
  problem: AppConfigProblem,
  setting: string | undefined,
  detail: string | undefined,
): string {
  const at = `${path}.${setting ?? '(document)'}`;
  switch (problem) {
    case 'missing-document':
      return `${path} does not exist.`;
    case 'invalid-setting':
      return `${at} is missing or does not match its schema (${detail ?? 'invalid'}).`;
    case 'invalid-update':
      return `${at} would not match its schema after this update (${detail ?? 'invalid'}).`;
  }
}

export class AppConfigInvalidError extends Error {
  readonly path: string;
  readonly problem: AppConfigProblem;
  readonly setting: string | undefined;

  constructor(path: string, problem: AppConfigProblem, setting?: string, detail?: string) {
    super(messageFor(path, problem, setting, detail));
    this.name = 'AppConfigInvalidError';
    this.path = path;
    this.problem = problem;
    this.setting = setting;
  }
}
