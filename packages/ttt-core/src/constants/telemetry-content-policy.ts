// TTT's telemetry content policy (QUALITY-106): which keys of a monitoring event may carry text.
// monitoring-core's `createTelemetryContentPolicy` applies it, so the Functions backend and the
// Next server and edge runtimes cut every event to the same allowlist. Plain data with no
// monitoring-core import, so ttt-core takes no dependency on it; the shape matches that factory's
// options.
//
// Widening either list to a key that can hold prose, a stored document, a file name, or a storage
// or document path breaks QUALITY-106: only identifiers, codes, and enum values may ride as text.

export const TTT_TELEMETRY_CONTENT_POLICY = {
  /** Keys whose text value is diagnostic: the descriptors capture sites set. */
  diagnosticKeys: [
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
    // The snake_case tag keys the safety alarms, the NCII inventory fallback, and post validation set.
    'deadline_lane',
    'monitor_stage',
    'safe_code',
    'leftover_cause',
    'ncii_inventory_fallback',
    'validation_error',
    // `captureException(error, { extra: {…} })` lands as an extra named `extra` (monitoring-core's
    // capture context): the container passes and its own keys are checked.
    'extra',
  ],
  /** An identifier, hash, code, or enum value named by its suffix (`caseId`, `targetKeyHash`, `fileOrigin`). */
  diagnosticKeySuffixes: ['Id', 'Ids', 'Uid', 'Uids', 'Hash', 'Type', 'Kind', 'Status', 'Code', 'Outcome', 'Origin', 'Source'],
  /** The context capture sites name the running function in (`scope.setContext('function', { name })`). */
  codeNameContexts: ['function'],
} as const;
