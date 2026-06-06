// Business rule constants shared between frontend and backend, split by domain.
// This barrel re-exports the per-domain files so the published constants surface
// (and every existing `constants/business.js` import) stays unchanged.
export * from "./business-work-project.js";
export * from "./business-content.js";
export * from "./business-admin.js";
export * from "./business-user.js";
export * from "./business-platform.js";




