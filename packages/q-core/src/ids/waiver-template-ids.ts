// The id of one published version of a waiver template: `v{version}`, version counting from 1.

const WAIVER_TEMPLATE_VERSION_ID_PREFIX = 'v';
const WAIVER_TEMPLATE_VERSION_ID_PATTERN = new RegExp(`^${WAIVER_TEMPLATE_VERSION_ID_PREFIX}([1-9]\\d*)$`);

export function buildWaiverTemplateVersionId(version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`A waiver template version is a whole number from 1; got ${version}.`);
  }
  return `${WAIVER_TEMPLATE_VERSION_ID_PREFIX}${version}`;
}

/** The version a `v{version}` id names, or `null` when the id is not one. */
export function parseWaiverTemplateVersionId(versionId: string): number | null {
  const match = WAIVER_TEMPLATE_VERSION_ID_PATTERN.exec(versionId);
  return match ? Number(match[1]) : null;
}
