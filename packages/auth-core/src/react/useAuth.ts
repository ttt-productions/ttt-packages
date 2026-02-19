"use client";

import { useContext } from "react";
import { AuthContext } from "./AuthProvider";
import type { BaseProfile, AuthContextValue } from "./types";

/**
 * Access the auth context. Must be used within an AuthProvider.
 * Generic params let each app specify its own profile + claims types.
 */
export function useAuth<
  TProfile extends BaseProfile = BaseProfile,
  TClaims = Record<string, unknown>,
>(): AuthContextValue<TProfile, TClaims> {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx as AuthContextValue<TProfile, TClaims>;
}
