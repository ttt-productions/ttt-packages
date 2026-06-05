// User-related Firestore document types

// Document shapes are defined as Zod schemas in ../doc-schemas/user.ts; the types
// are inferred from them (single source of truth — see
// docs/design/firestore-schema-registry.md in ttt-prod). This module re-exports
// the inferred types so the public type surface and the main barrel are unchanged.
export type {
  CraftSkill,
  CraftSkillReference,
  MinimalCraftSkill,
  OwnedWorkProject,
  AssociatedWorkProject,
  FullUser,
  UserAgreements,
  UserPrivateData,
} from '../doc-schemas/user.js';

