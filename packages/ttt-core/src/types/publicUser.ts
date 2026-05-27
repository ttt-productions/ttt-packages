// Thin canonical user-display doc. Mirrored from userProfiles via Cloud Function trigger.
// Read by everything that needs name + avatar; written ONLY by the server-side mirror.
//
// disabled is derived from FullUser.status: status !== 'active' -> disabled: true.
//   missing/undefined status defaults to active (disabled: false).

export type PublicUser = {
  uid: string;
  displayName: string;
  profilePictureUrlFull?: string | null;
  profilePictureUrlMedium?: string | null;
  profilePictureUrlSmall?: string | null;
  artisanCreator?: string;
  disabled?: boolean;
};
