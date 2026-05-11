"use client";

import { useContext } from "react";
import { AuthContext } from "./AuthProvider.js";
import type { AuthContextValue } from "./types.js";

/**
 * Access the auth context. Must be used within an AuthProvider.
 * Generic param lets each app specify its own claims type.
 */
export function useAuth<TClaims = Record<string, unknown>>(): AuthContextValue<TClaims> {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx as AuthContextValue<TClaims>;
}
