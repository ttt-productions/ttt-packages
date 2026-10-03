import { describe, it, expect } from 'vitest';
import { TTT_TELEMETRY_CONTENT_POLICY } from '../src/constants/telemetry-content-policy';
import * as root from '../src/index';

// One telemetry content policy on every backend runtime: the Functions tree and the Next server and
// edge inits all build the same allowlist from this one declaration.
describe('TTT_TELEMETRY_CONTENT_POLICY', () => {
  it('admits as text the identifier, code, and enum keys capture sites use, matched exactly', () => {
    expect([...TTT_TELEMETRY_CONTENT_POLICY.diagnosticKeys].sort()).toEqual(
      [
        'uid',
        'operation',
        'function',
        'step',
        'stage',
        'phase',
        'kind',
        'type',
        'category',
        'action',
        'leg',
        'reason',
        'code',
        'claim',
        'remaining',
        'scores',
        'issues',
        'groupKey',
        'context',
        'diagnostic',
        'reportReason',
        'deadline_lane',
        'monitor_stage',
        'safe_code',
        'leftover_cause',
        'ncii_inventory_fallback',
        'validation_error',
        'extra',
      ].sort(),
    );
  });

  it('admits as text a camelCase key naming an identifier, hash, code, or enum value by its suffix', () => {
    expect([...TTT_TELEMETRY_CONTENT_POLICY.diagnosticKeySuffixes].sort()).toEqual(
      ['Id', 'Ids', 'Uid', 'Uids', 'Hash', 'Type', 'Kind', 'Status', 'Code', 'Outcome', 'Origin', 'Source'].sort(),
    );
  });

  it('keeps the `function` context name, the code name of the function that ran', () => {
    expect([...TTT_TELEMETRY_CONTENT_POLICY.codeNameContexts]).toEqual(['function']);
  });

  it('never admits a key that holds prose, a document, a file name, a path, or contact data', () => {
    const prose = ['title', 'name', 'description', 'message', 'body', 'text', 'caption', 'note', 'comment', 'narrative'];
    const located = ['path', 'storagePath', 'docPath', 'url', 'fileName', 'gcsUri', 'email', 'ip', 'afterData', 'data'];
    for (const key of [...prose, ...located]) {
      expect(TTT_TELEMETRY_CONTENT_POLICY.diagnosticKeys as readonly string[], key).not.toContain(key);
    }
    for (const suffix of ['Name', 'Title', 'Path', 'Url', 'Text', 'Message', 'Email', 'Data']) {
      expect(TTT_TELEMETRY_CONTENT_POLICY.diagnosticKeySuffixes as readonly string[], suffix).not.toContain(suffix);
    }
  });

  it('lists each key and suffix once', () => {
    const { diagnosticKeys, diagnosticKeySuffixes } = TTT_TELEMETRY_CONTENT_POLICY;
    expect(new Set(diagnosticKeys).size).toBe(diagnosticKeys.length);
    expect(new Set(diagnosticKeySuffixes).size).toBe(diagnosticKeySuffixes.length);
  });

  it('is importable from the server-safe root, where the Functions tree and the Next inits read it', () => {
    expect(root.TTT_TELEMETRY_CONTENT_POLICY).toBe(TTT_TELEMETRY_CONTENT_POLICY);
  });
});
