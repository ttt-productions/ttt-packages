// Thin canonical user-display + search projection. Mirrored from userProfiles via Cloud
// Function trigger. Read by everything that needs name + avatar; written ONLY by the
// server-side mirror. Clients never write this doc.
//
// displayName_lowercase powers prefix search. disabled is derived from FullUser.status
// (status !== 'active' -> true) and is ALWAYS written explicitly (active -> false) so user
// search has a stable equality filter.

export type PublicUser = {
  uid: string;
  displayName: string;
  displayName_lowercase: string;
  profilePictureUrlFull?: string | null;
  profilePictureUrlMedium?: string | null;
  profilePictureUrlSmall?: string | null;
  artisanCreator?: number;
  disabled: boolean;
};
