// Admin task lifecycle types now live in @ttt-productions/report-core
// (generic at type level). ttt-core retains only the TTT-specific
// task-type union that binds the generic at consumption sites.

export type AdminTaskType =
  | 'adminDispatch'
  | 'libraryReview'
  | 'userReport'
  | 'content-appeal'
  | 'shareAnomaly';
