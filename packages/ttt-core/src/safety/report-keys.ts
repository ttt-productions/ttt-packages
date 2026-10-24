import { createHash } from 'node:crypto';
import type { ReportableItemType } from '../doc-schemas/safety/foundation.js';
import { REPORT_CANONICAL_KEY_VERSION } from '../doc-schemas/safety/report.js';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

const SEP = ':';

// UTF-8 bytes, never `String.length` (UTF-16 code units): the prefix must match the hashed bytes.
function lp(value: string): string {
  return `${Buffer.byteLength(value, 'utf8')}${SEP}${value}`;
}

export interface CanonicalTargetKeyInput {
  readonly itemType: ReportableItemType;
  readonly canonicalParentPath: string;
  readonly canonicalItemId: string;
  readonly revision: number;
}

// A change to this composition re-keys every report id and group key, so it moves only with
// REPORT_CANONICAL_KEY_VERSION.
export function canonicalTargetKey(input: CanonicalTargetKeyInput): string {
  const { itemType, canonicalParentPath, canonicalItemId, revision } = input;
  return sha256Hex(
    [REPORT_CANONICAL_KEY_VERSION, itemType, canonicalParentPath, canonicalItemId, String(revision)]
      .map(lp)
      .join(''),
  );
}

export interface ReportIdInput {
  readonly reporterUid: string;
  readonly canonicalTargetKey: string;
}

export function reportId(input: ReportIdInput): string {
  return sha256Hex(
    [REPORT_CANONICAL_KEY_VERSION, input.reporterUid, input.canonicalTargetKey].map(lp).join(''),
  );
}

export function reportGroupKey(canonicalTargetKeyValue: string): string {
  return canonicalTargetKeyValue;
}
