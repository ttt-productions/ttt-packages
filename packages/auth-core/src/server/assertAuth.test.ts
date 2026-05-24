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
  creator?: string;
};

type TestProject = {
  projectId: string;
  ownedBy?: { uid: string };
  activeUserIds?: Record<string, boolean>;
  activeUsers?: Array<{ uid: string }>;
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

const creatorUserDoc: TestUser = {
  ...activeUserDoc,
  creator: "creator-12345",
};

function memberProjectDoc(callerUid: string): TestProject {
  return {
    projectId: "p1",
    ownedBy: { uid: "owner-uid" },
    activeUserIds: { [callerUid]: true },
    activeUsers: [],
  };
}

// --- harness ---------------------------------------------------------------

let mockUserGet: ReturnType<typeof vi.fn>;
let mockProjectGet: ReturnType<typeof vi.fn>;
let mockRequireAdmin: ReturnType<typeof vi.fn>;
let mockIsProjectActionAllowed: ReturnType<typeof vi.fn>;
let mockDbDoc: ReturnType<typeof vi.fn>;
let assertAuth: ReturnType<typeof createAssertAuth<TestUser, TestProject>>;

beforeEach(() => {
  mockUserGet = vi.fn().mockResolvedValue({ exists: true, data: () => activeUserDoc });
  mockProjectGet = vi.fn().mockResolvedValue({
    exists: true,
    data: () => memberProjectDoc("uid-123"),
  });
  mockRequireAdmin = vi.fn().mockResolvedValue(undefined);
  mockIsProjectActionAllowed = vi.fn(async ({ project, uid, action }) =>
    action === "project.read" &&
    (project.ownedBy?.uid === uid || project.activeUserIds?.[uid] === true || (project.activeUsers || []).some((u: { uid: string }) => u.uid === uid))
  );

  const userDocRef = { get: mockUserGet };
  const projectDocRef = { get: mockProjectGet };

  mockDbDoc = vi.fn((path: string) => {
    if (path.startsWith("allProjects/")) return projectDocRef;
    return userDocRef;
  });

  const fakeDb = { doc: mockDbDoc } as any;

  const config: AssertAuthConfig<TestUser, TestProject> = {
    firestore: () => fakeDb,
    userProfilePath: (uid) => `userProfiles/${uid}`,
    projectPath: (projectId) => `allProjects/${projectId}`,
    getUserStatus: (user): UserStatus => {
      if (user.status === "disabled") return "disabled";
      if (user.status === "banned") return "banned";
      return "ok";
    },
    isUserCreator: (user) => Boolean(user.creator),
    isProjectOwner: (project, uid) => project.ownedBy?.uid === uid,
    isProjectMember: (project, uid) =>
      project.ownedBy?.uid === uid ||
      project.activeUserIds?.[uid] === true ||
      (project.activeUsers || []).some((u) => u.uid === uid),
    isProjectActionAllowed: mockIsProjectActionAllowed as any,
    requireAdmin: mockRequireAdmin as any,
  };

  assertAuth = createAssertAuth<TestUser, TestProject>(config);
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
    expect(ctx.project).toBeUndefined();
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

describe("Creator check", () => {
  it("throws failed-precondition when user has no creator field", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc }),
    });
    await expect(
      assertAuth(makeRequest(), { creator: true, allowAnyStatus: true })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("succeeds when user has a truthy creator string", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => creatorUserDoc,
    });
    const ctx = await assertAuth(makeRequest(), {
      creator: true,
      allowAnyStatus: true,
    });
    expect(ctx.userDoc).toMatchObject({ creator: "creator-12345" });
  });

  it("throws not-found when user doc is missing and creator check runs", async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(
      assertAuth(makeRequest(), { creator: true, allowAnyStatus: true })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws permission-denied (not failed-precondition) when user is banned and creator=true", async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...creatorUserDoc, status: "banned" }),
    });
    // banned check in step 4 fires before creator check in step 5
    await expect(
      assertAuth(makeRequest(), { creator: true })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("Project membership", () => {
  it("throws not-found when project doc does not exist", async () => {
    mockProjectGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(
      assertAuth(makeRequest(), {
        projectMembership: { projectId: "p1", action: "project.read" },
        allowAnyStatus: true,
      })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws permission-denied when caller is not in any membership field", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "other-uid" },
        activeUserIds: { "another-uid": true },
        activeUsers: [{ uid: "yet-another-uid" }],
      }),
    });
    await expect(
      assertAuth(makeRequest(), {
        projectMembership: { projectId: "p1", action: "project.read" },
        allowAnyStatus: true,
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("succeeds and sets isMember=true, isOwner=false when caller is in activeUserIds", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "owner-uid" },
        activeUserIds: { "uid-123": true },
        activeUsers: [],
      }),
    });
    const ctx = await assertAuth(makeRequest(), {
      projectMembership: { projectId: "p1", action: "project.read" },
      allowAnyStatus: true,
    });
    expect(ctx.project?.isMember).toBe(true);
    expect(ctx.project?.isOwner).toBe(false);
  });

  it("succeeds when caller is in activeUsers array but not in activeUserIds", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "owner-uid" },
        activeUserIds: {},
        activeUsers: [{ uid: "uid-123" }],
      }),
    });
    const ctx = await assertAuth(makeRequest(), {
      projectMembership: { projectId: "p1", action: "project.read" },
      allowAnyStatus: true,
    });
    expect(ctx.project?.isMember).toBe(true);
    expect(ctx.project?.isOwner).toBe(false);
  });

  it("succeeds and sets isOwner=true, isMember=true when caller is ownedBy.uid", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "uid-123" },
        activeUserIds: {},
        activeUsers: [],
      }),
    });
    const ctx = await assertAuth(makeRequest(), {
      projectMembership: { projectId: "p1", action: "project.read" },
      allowAnyStatus: true,
    });
    expect(ctx.project?.isOwner).toBe(true);
    expect(ctx.project?.isMember).toBe(true);
  });

  it("throws permission-denied when action callback denies the project action", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "owner-uid" },
        activeUserIds: { "uid-123": true },
        activeUsers: [],
      }),
    });
    mockIsProjectActionAllowed.mockResolvedValue(false);
    await expect(
      assertAuth(makeRequest(), {
        projectMembership: { projectId: "p1", action: "member.role.update" },
        allowAnyStatus: true,
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("succeeds when action callback allows the project action", async () => {
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "uid-123" },
        activeUserIds: {},
        activeUsers: [],
      }),
    });
    mockIsProjectActionAllowed.mockResolvedValue(true);
    const ctx = await assertAuth(makeRequest(), {
      projectMembership: { projectId: "p1", action: "member.role.update" },
      allowAnyStatus: true,
    });
    expect(ctx.project?.isOwner).toBe(true);
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
});

describe("Combined checks", () => {
  it("fails on email check first when emailVerified and creator are both required but email is unverified", async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: false }), {
        emailVerified: true,
        creator: true,
      })
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("Email"),
    });
  });

  it("fails with creator error when email is verified but user lacks creator status", async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => activeUserDoc });
    await expect(
      assertAuth(makeRequest({ emailVerified: true }), {
        emailVerified: true,
        creator: true,
      })
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("Creator"),
    });
  });

  it("returns fully populated ctx when all checks pass", async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => creatorUserDoc });
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => ({
        projectId: "p1",
        ownedBy: { uid: "uid-123" },
        activeUserIds: {},
        activeUsers: [],
      }),
    });
    mockRequireAdmin.mockResolvedValue(undefined);

    const ctx = await assertAuth(makeRequest({ emailVerified: true }), {
      emailVerified: true,
      creator: true,
      projectMembership: { projectId: "p1", action: "project.read" },
      admin: { allowJrAdmin: true },
    });

    expect(ctx.uid).toBe("uid-123");
    expect(ctx.userDoc).toMatchObject({ creator: "creator-12345" });
    expect(ctx.project?.isOwner).toBe(true);
    expect(ctx.project?.isMember).toBe(true);
    expect(mockRequireAdmin).toHaveBeenCalled();
  });
});

describe("Parallelization", () => {
  it("calls both user-doc and project-doc get() when both are needed", async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => creatorUserDoc });
    mockProjectGet.mockResolvedValue({
      exists: true,
      data: () => memberProjectDoc("uid-123"),
    });

    await assertAuth(makeRequest(), {
      creator: true,
      projectMembership: { projectId: "p1", action: "project.read" },
      allowAnyStatus: true,
    });

    expect(mockUserGet).toHaveBeenCalledOnce();
    expect(mockProjectGet).toHaveBeenCalledOnce();
  });
});
