import { describe, it, expect, vi, beforeEach } from "vitest";

// NOTE: there is deliberately NO `vi.mock("firebase-functions/v2/https")` here.
// assertAuth no longer constructs HttpsError — it throws AuthAssertionError and the
// consuming app maps it (see authError.ts for why). The only remaining reference to
// firebase-functions in assertAuth.ts is a TYPE import, which is erased at runtime.
import { createAssertAuth } from "./assertAuth.js";
import { AuthAssertionError } from "./authError.js";
import type { AssertAuthConfig, UserStatus } from "./types.js";

type TestUser = {
  uid: string;
  displayName?: string;
  status?: "active" | "suspended" | "banned";
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
      if (user.status === "banned") return "banned";
      if (user.status === "suspended") return "suspended";
      return "active";
    },
    requireAdmin: mockRequireAdmin as any,
  };

  assertAuth = createAssertAuth<TestUser>(config);
});

// --- tests -----------------------------------------------------------------

// REGRESSION GUARD (2026-07-20). assertAuth must throw a plain, framework-free
// AuthAssertionError — never an HttpsError built inside this package. firebase-functions
// 7.2.5 ships two distinct HttpsError classes (ESM entry vs the CJS callable runtime), so
// a package-built HttpsError fails the runtime's `instanceof` check and onCall converts a
// correct 400 into a 500 INTERNAL. Since assertAuth is the first line of every callable,
// that silently broke EVERY auth rejection in deployed environments. If someone
// reintroduces `new HttpsError(...)` here, these assertions fail.
describe("throws a framework-free typed error (never a package-built HttpsError)", () => {
  it("rejects with an AuthAssertionError instance carrying the HttpsError code string", async () => {
    const err = await assertAuth(makeUnauthRequest()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect((err as AuthAssertionError).name).toBe("AuthAssertionError");
    expect((err as AuthAssertionError).code).toBe("unauthenticated");
  });

  it("does not decorate the error with HttpsError's own shape", async () => {
    const err = (await assertAuth(makeUnauthRequest()).catch(
      (e: unknown) => e
    )) as AuthAssertionError & { httpErrorCode?: unknown; toJSON?: unknown };
    // `httpErrorCode`/`toJSON` are HttpsError internals — their absence proves the
    // package is not constructing one, which is the whole point of the fix.
    expect(err.httpErrorCode).toBeUndefined();
    expect(err.toJSON).toBeUndefined();
  });

  it("uses AuthAssertionError for the email-verification rejection too", async () => {
    const err = await assertAuth(makeRequest({ emailVerified: false }), {
      emailVerified: true,
      allowAnyStatus: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect((err as AuthAssertionError).code).toBe("failed-precondition");
  });
});

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

  it("throws permission-denied when user status is suspended", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "suspended" }),
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

describe("allowSuspended opt-in", () => {
  it("allows a suspended user when allowSuspended is true", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "suspended" }),
    });
    const ctx = await assertAuth(makeRequest(), { allowSuspended: true });
    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toMatchObject({ status: "suspended" });
  });

  it("still blocks a banned user even when allowSuspended is true", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: "banned" }),
    });
    await expect(
      assertAuth(makeRequest(), { allowSuspended: true })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("still requires the user doc to exist when allowSuspended is true", async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(
      assertAuth(makeRequest(), { allowSuspended: true })
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
        if (user.status === "banned") return "banned";
        if (user.status === "suspended") return "suspended";
        return "active";
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
