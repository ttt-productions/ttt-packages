// Thin canonical user-display + search projection. Mirrored from userProfiles via Cloud
// Function trigger. Read by everything that needs name + avatar; written ONLY by the
// server-side mirror. Clients never write this doc.
//
// displayName_lowercase powers prefix search. disabled is derived from FullUser.status
// (status !== 'active' -> true) and is ALWAYS written explicitly (active -> false) so user
// search has a stable equality filter.

// Shape defined as a Zod schema in ../doc-schemas/publicUser.ts; type inferred there.
export type { PublicUser } from '../doc-schemas/publicUser.js';
