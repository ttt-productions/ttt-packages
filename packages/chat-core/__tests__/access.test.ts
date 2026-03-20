import { describe, it, expect } from "vitest";
import { canAccessThread } from "../src/hooks/useChatThreadAccess.js";

describe("canAccessThread", () => {
  it("admin always returns true even with empty allowedUserIds", () => {
    expect(canAccessThread({ isAdmin: true, currentUserId: "u1", allowedUserIds: [] })).toBe(true);
  });

  it("admin returns true with undefined allowedUserIds", () => {
    expect(canAccessThread({ isAdmin: true, currentUserId: "u1" })).toBe(true);
  });

  it("non-admin in allowedUserIds returns true", () => {
    expect(
      canAccessThread({ isAdmin: false, currentUserId: "u1", allowedUserIds: ["u1", "u2"] })
    ).toBe(true);
  });

  it("non-admin NOT in allowedUserIds returns false", () => {
    expect(
      canAccessThread({ isAdmin: false, currentUserId: "u3", allowedUserIds: ["u1", "u2"] })
    ).toBe(false);
  });

  it("non-admin with undefined allowedUserIds returns false", () => {
    expect(canAccessThread({ isAdmin: false, currentUserId: "u1" })).toBe(false);
  });

  it("non-admin with empty allowedUserIds returns false", () => {
    expect(canAccessThread({ isAdmin: false, currentUserId: "u1", allowedUserIds: [] })).toBe(
      false
    );
  });
});
