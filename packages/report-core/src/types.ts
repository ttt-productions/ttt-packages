// Canonical report-core types, split by concern. This barrel re-exports the
// per-concern files so the published surface (and existing `./types.js`
// imports) stays unchanged.
export * from './types-admin-task.js';
export * from './types-report.js';
export * from './types-config.js';
export * from './types-ui-props.js';

