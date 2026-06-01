import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  }
  return { HttpsError };
});

import { createAssertAuth } from "./assertAuth.js";
import type { AssertAuthConfig, UserStatus } from "./types.js";

type TestUser = {
  uid: string;
  displayName?: string;
  status?: "active" | "banned" | "disabled";
};


function makeRequest(opts?: { uid?: string; emailVerified?: boolean }): any {
  const uid = opts?.uid ?? "uid-123";
  return {
    data: {},
    rawRequest: {},
    auth: {
      uid,
      token: { uid, email_verified: opts?.emailVerified ?? true },
    },
  };
}

function makeUnauthRequest(): any {
  return { data: {}, rawRequest: {}, auth: undefined };
}

const activeUserDoc: TestUser = {
  uid: "uid-123",
  displayName: "Test User",
  status: "active",
};

// Minimal Firestore stub returning the active user doc, for tests that build
// their own config instead of using the shared beforeEach harness.
function fakeDbWithUser(): any {
  const userDocRef = {
    get: vi.fn().mockResolvedValue({ exists: true, data: () => activeUserDoc }),
  };
  return { doc: vi.fn(() => userDocRef) };
}

// --- harness ---------------------------------------------------------------

let mockUserGet: ReturnType<typeof vi.fn>;
let mockRequireAdmin: ReturnType<typeof vi.fn>;
let mockDbDoc: ReturnType<typeof vi.fn>;
let assertAuth: ReturnType<typeof createAssertAuth<TestUser>>;

beforeEach(() => {
  mockUserGet = vi.fn().mockResolvedValue({ exists: true, data: () => activeUserDoc });
  mockRequireAdmin = vi.fn().mockResolvedValue(undefined);

  const userDocRef = { get: mockUserGet };

  mockDbDoc = vi.fn(() => userDocRef);

  const fakeDb = { doc: mockDbDoc } as any;

  const config: AssertAuthConfig<TestUser> = {
    firestore: () => fakeDb,
    userProfilePath: (uid) => `userProfiles/${uid}`,
    getUserStatus: (user): UserStatus => {
      if (user.status === "disabled") return "disabled";
      if (user.status === "banned") return "banned";
      return "ok";
    },
    requireAdmin: mockRequireAdmin as any,
  };

  assertAuth = createAssertAuth<TestUser>(config);
});

// --- tests -----------------------------------------------------------------

describe("Authentication", () => {
  it("throws unauthenticated when request.auth is absent", async () => {
    await expect(assertAuth(makeUnauthRequest())).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("succeeds with no Firestore reads when only allowAnyStatus is set", async () => {
    const ctx = await assertAuth(makeRequest(), { allowAnyStatus: true });
    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toBeUndefined();
    expect(mockDbDoc).not.toHaveBeenCalled();
  });
});

describe("Email verification", () => {
  it("throws failed-precondition when emailVerified required and token email_verified is false", async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: false }), {
        emailVerified: true,
        allowAnyStatus: true,
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("succeeds when emailVerified required and token email_verified is true", async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: true }), {
        emailVerified: true,
        allowAnyStatus: true,
      })
    ).resolves.toMatchObject({ uid: "uid-123" });
  });

  it("succeeds when allowUnverified is true even if email_verified is false", async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: false }), {
        emailVerified: true,
        allowUnverified: true,
        allowAnyStatus: true,
      })
    ).resolves.toMatchObject({ uid: "uid-123" });
  });
});

describe("Not-banned check (default behavior)", () => {
  it("throws permission-denied when user status is banned", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "banned" }),
    });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("throws permission-denied when user status is disabled", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "disabled" }),
    });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("throws not-found when user doc does not exist", async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("succeeds when user doc has no status field", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "uid-123", displayName: "Test" }),
    });
    const ctx = await assertAuth(makeRequest());
    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toBeDefined();
  });

  it("succeeds when user status is active", async () => {
    const ctx = await assertAuth(makeRequest());
    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toMatchObject({ status: "active" });
  });

  it("skips user doc read entirely when allowAnyStatus is true", async () => {
    await assertAuth(makeRequest(), { allowAnyStatus: true });
    expect(mockUserGet).not.toHaveBeenCalled();
  });
});

describe("allowBanned opt-in", () => {
  it("allows a banned user when allowBanned is true", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "banned" }),
    });
    const ctx = await assertAuth(makeRequest(), { allowBanned: true });
    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toMatchObject({ status: "banned" });
  });

  it("still blocks a disabled user even when allowBanned is true", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "disabled" }),
    });
    await expect(
      assertAuth(makeRequest(), { allowBanned: true })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("still requires the user doc to exist when allowBanned is true", async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(
      assertAuth(makeRequest(), { allowBanned: true })
    ).rejects.toMatchObject({ code: "not-found" });
  });
});


describe("Admin check", () => {
  it("propagates the error when requireAdmin throws", async () => {
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error("Administrator access required"), {
        code: "permission-denied",
      })
    );
    await expect(
      assertAuth(makeRequest(), {
        admin: { allowJrAdmin: false },
        allowAnyStatus: true,
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("succeeds and returns ctx when requireAdmin resolves", async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    const ctx = await assertAuth(makeRequest(), {
      admin: { allowJrAdmin: true },
      allowAnyStatus: true,
    });
    expect(ctx.uid).toBe("uid-123");
    expect(mockRequireAdmin).toHaveBeenCalledWith(
      "uid-123",
      expect.any(Object),
      { allowJrAdmin: true }
    );
  });

  it("populates ctx.admin with the requireAdmin result when an admin check runs", async () => {
    type AdminResult = { role: string };
    const adminMock = vi.fn().mockResolvedValue({ role: "superadmin" });
    const config: AssertAuthConfig<TestUser, AdminResult> = {
      firestore: () => fakeDbWithUser(),
      userProfilePath: (uid) => `userProfiles/${uid}`,
      getUserStatus: (user): UserStatus => {
        if (user.status === "disabled") return "disabled";
        if (user.status === "banned") return "banned";
        return "ok";
      },
      requireAdmin: adminMock as any,
    };
    const typedAssertAuth = createAssertAuth<TestUser, AdminResult>(config);

    const ctx = await typedAssertAuth(makeRequest(), {
      admin: { allowJrAdmin: true },
    });

    expect(ctx.admin).toEqual({ role: "superadmin" });
  });

  it("leaves ctx.admin undefined when no admin requirement is set", async () => {
    const ctx = await assertAuth(makeRequest());
    expect(ctx.admin).toBeUndefined();
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });
});

describe("Combined checks", () => {
  it("returns fully populated ctx when all checks pass", async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => activeUserDoc });
    mockRequireAdmin.mockResolvedValue(undefined);

    const ctx = await assertAuth(makeRequest({ emailVerified: true }), {
      emailVerified: true,
      admin: { allowJrAdmin: true },
    });

    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toMatchObject({ status: "active" });
    expect(mockRequireAdmin).toHaveBeenCalled();
  });
});
