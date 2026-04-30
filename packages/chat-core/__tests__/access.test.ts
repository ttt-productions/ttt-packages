import { describe, it, expect } from "vitest";
import { canAccessThread } from "../src/hooks/useChatThreadAccess.js";

describe("canAccessThread", () => {
  describe("admin bypass", () => {
    it("admin returns true in firestore-rules mode without allowedUserIds", () => {
      expect(
        canAccessThread({
          accessMode: "firestore-rules",
          isAdmin: true,
          currentUserId: "u1",
        })
      ).toBe(true);
    });

    it("admin returns true in explicit-allowlist mode without allowedUserIds", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: true,
          currentUserId: "u1",
        })
      ).toBe(true);
    });

    it("admin returns true in explicit-allowlist mode even when not in allowedUserIds", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: true,
          currentUserId: "admin",
          allowedUserIds: ["u1", "u2"],
        })
      ).toBe(true);
    });
  });

  describe("unauthenticated user", () => {
    it("returns false with empty currentUserId in firestore-rules mode", () => {
      expect(
        canAccessThread({
          accessMode: "firestore-rules",
          isAdmin: false,
          currentUserId: "",
        })
      ).toBe(false);
    });

    it("returns false with empty currentUserId in explicit-allowlist mode", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: false,
          currentUserId: "",
          allowedUserIds: [""],
        })
      ).toBe(false);
    });
  });

  describe("firestore-rules mode", () => {
    it("returns true for any signed-in non-admin user", () => {
      expect(
        canAccessThread({
          accessMode: "firestore-rules",
          isAdmin: false,
          currentUserId: "u1",
        })
      ).toBe(true);
    });

    it("ignores allowedUserIds (defers to rules)", () => {
      expect(
        canAccessThread({
          accessMode: "firestore-rules",
          isAdmin: false,
          currentUserId: "u3",
          allowedUserIds: ["u1", "u2"],
        })
      ).toBe(true);
    });
  });

  describe("explicit-allowlist mode", () => {
    it("returns true when user is in allowedUserIds", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: false,
          currentUserId: "u1",
          allowedUserIds: ["u1", "u2"],
        })
      ).toBe(true);
    });

    it("returns false when user is not in allowedUserIds", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: false,
          currentUserId: "u3",
          allowedUserIds: ["u1", "u2"],
        })
      ).toBe(false);
    });

    it("returns false when allowedUserIds is undefined", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: false,
          currentUserId: "u1",
        })
      ).toBe(false);
    });

    it("returns false when allowedUserIds is empty", () => {
      expect(
        canAccessThread({
          accessMode: "explicit-allowlist",
          isAdmin: false,
          currentUserId: "u1",
          allowedUserIds: [],
        })
      ).toBe(false);
    });
  });
});
