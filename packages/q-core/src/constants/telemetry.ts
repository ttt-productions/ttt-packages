// Plain data with no monitoring-core import, so `q-core` binds no monitoring at all
// (RULE-STD-QUALITY-102).

export const TELEMETRY_CONTENT_POLICY = {
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
  diagnosticKeySuffixes: ['Id', 'Ids', 'Type', 'Kind', 'Status', 'Code', 'Outcome', 'Origin'],
  codeNameContexts: ['function'],
} as const;
