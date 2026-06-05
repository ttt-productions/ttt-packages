// Admin task lifecycle types now live in @ttt-productions/report-core
// (generic at type level). ttt-core retains only the TTT-specific
// task-type union that binds the generic at consumption sites.

// Defined as a Zod enum in ../doc-schemas/report-docs.ts; type inferred there.
export type { AdminTaskType } from '../doc-schemas/report-docs.js';

