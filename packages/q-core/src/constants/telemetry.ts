// The Q-Sports telemetry content policy (QUALITY-106): which keys of a monitoring event may carry
// text. monitoring-core's `createTelemetryContentPolicy` applies it, so the Functions backend and the
// Next server and edge runtimes cut every event to the same allowlist. Plain data with no
// monitoring-core import, so `q-core` binds no monitoring at all (QUALITY-102); the shape matches
// that factory's options.
//
// Widening either list to a key that can hold prose, a stored document, a file name, or a storage or
// document path breaks QUALITY-106: only identifiers, codes, and enum values may ride as text.

export const TELEMETRY_CONTENT_POLICY = {
  /** Keys whose text value is diagnostic: the descriptors the capture sites set. */
  diagnosticKeys: [
    'fn',
    'kind',
    'operation',
    'step',
    'pass',
    'area',
    'action',
    'phase',
    'stage',
    'code',
    'reason',
    // `captureException(error, { extra: {…} })` lands as an extra named `extra` (monitoring-core's
    // capture context): the container passes and its own keys are checked.
    'extra',
  ],
  /** An identifier, code, or enum value named by its suffix (`pendingMediaId`, `auditEventType`). */
  diagnosticKeySuffixes: ['Id', 'Ids', 'Type', 'Kind', 'Status', 'Code', 'Outcome', 'Origin'],
  /** The context the capture sites name the running function in (`scope.setContext('function', { name })`). */
  codeNameContexts: ['function'],
} as const;
