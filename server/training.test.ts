import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getAllUsers: vi.fn().mockResolvedValue([]),
  getPendingUsers: vi.fn().mockResolvedValue([]),
  updateUserApproval: vi.fn().mockResolvedValue(undefined),
  updateUserTeamRole: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(undefined),
  getUserProgress: vi.fn().mockResolvedValue([]),
  getTrackByRole: vi.fn().mockResolvedValue(null),
  getMilestonesByTrack: vi.fn().mockResolvedValue([]),
  getModulesByMilestone: vi.fn().mockResolvedValue([]),
  getSopCategories: vi.fn().mockResolvedValue([]),
  getAllSops: vi.fn().mockResolvedValue([]),
  getSopById: vi.fn().mockResolvedValue(null),
  getSopVersions: vi.fn().mockResolvedValue([]),
  markSopReviewed: vi.fn().mockResolvedValue(undefined),
  getUserSopReviewFlags: vi.fn().mockResolvedValue([]),
  getTracks: vi.fn().mockResolvedValue([]),
  getModuleById: vi.fn().mockResolvedValue(null),
  getModuleProgress: vi.fn().mockResolvedValue(null),
  getQuizAttempts: vi.fn().mockResolvedValue([]),
  getQuizByModuleId: vi.fn().mockResolvedValue(null),
  upsertModuleProgress: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn().mockResolvedValue(undefined),
  upsertQuiz: vi.fn().mockResolvedValue(undefined),
  saveQuizAttempt: vi.fn().mockResolvedValue(undefined),
  getUserNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  getAdminStats: vi.fn().mockResolvedValue({ totalUsers: 0 }),
  getDb: vi.fn().mockResolvedValue(null),
  getSopByGoogleDocId: vi.fn().mockResolvedValue(null),
  flagSopForAllUsers: vi.fn().mockResolvedValue(undefined),
  upsertSop: vi.fn().mockResolvedValue(undefined),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getUserById: vi.fn().mockResolvedValue(null),
  areTestOutsMastered: vi.fn().mockResolvedValue(true),
  getMilestoneById: vi.fn().mockResolvedValue(null),
  setTestOutGrade: vi.fn().mockResolvedValue({ id: 1 }),
  createUserWithPassword: vi.fn().mockResolvedValue({
    id: 2, email: "new@reformationchiropractic.com", name: "New Hire", role: "user", teamRole: "ca",
  }),
}));

vi.mock("./emailAuth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  generateResetToken: vi.fn().mockReturnValue("token"),
  resetTokenExpiresAt: vi.fn().mockReturnValue(new Date()),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ questions: [] }) } }],
  }),
}));

function makeCtx(overrides: Partial<TrpcContext["user"]> = {}, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@reformationchiropractic.com",
      name: "Test User",
      loginMethod: "google",
      role,
      approvalStatus: "approved",
      teamRole: "ca",
      approvedAt: new Date(),
      approvedBy: null,
      onboardingCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("auth router", () => {
  it("returns current user from me query", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.email).toBe("test@reformationchiropractic.com");
  });

  it("clears session cookie on logout", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("sops router", () => {
  it("returns categories for approved users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sops.categories();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for pending users", async () => {
    const ctx = makeCtx({ approvalStatus: "pending" } as any);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sops.categories()).rejects.toThrow();
  });

  it("marks SOP as reviewed", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sops.markReviewed({ sopId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("tracks router", () => {
  it("returns null track when no role assigned", async () => {
    const ctx = makeCtx({ teamRole: null } as any);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tracks.myTrack();
    expect(result).toBeNull();
  });
});

describe("progress router", () => {
  it("returns user progress", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.progress.mine();
    expect(Array.isArray(result)).toBe(true);
  });

  it("updates module progress", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.progress.update({ moduleId: 1, status: "in_progress" });
    expect(result.success).toBe(true);
  });
});

describe("onboarding completion gate", () => {
  // A track with one module that the trainee has just completed, plus a track
  // and user that are otherwise ready to be marked "complete".
  async function primeReadyToComplete() {
    const dbm = await import("./db");
    vi.mocked(dbm.getUserById).mockResolvedValue({
      id: 1, name: "Test User", email: "test@reformationchiropractic.com",
      teamRole: "ca", onboardingCompletedAt: null,
    } as any);
    vi.mocked(dbm.getTrackByRole).mockResolvedValue({ id: 5, teamRole: "ca", name: "CA" } as any);
    vi.mocked(dbm.getMilestonesByTrack).mockResolvedValue([{ id: 50 } as any]);
    vi.mocked(dbm.getModulesByMilestone).mockResolvedValue([{ id: 1 } as any]);
    vi.mocked(dbm.getUserProgress).mockResolvedValue([{ moduleId: 1, status: "completed" } as any]);
    vi.mocked(dbm.createNotification).mockClear();
    return dbm;
  }

  it("does NOT complete onboarding while a test-out is unmastered", async () => {
    const dbm = await primeReadyToComplete();
    vi.mocked(dbm.areTestOutsMastered).mockResolvedValue(false);

    const caller = appRouter.createCaller(makeCtx());
    await caller.progress.update({ moduleId: 1, status: "completed" });

    const firedComplete = vi.mocked(dbm.createNotification).mock.calls
      .some(c => (c[0] as any)?.type === "onboarding_complete");
    expect(firedComplete).toBe(false);
  });

  it("completes onboarding once all modules done AND all test-outs mastered", async () => {
    const dbm = await primeReadyToComplete();
    vi.mocked(dbm.areTestOutsMastered).mockResolvedValue(true);

    const caller = appRouter.createCaller(makeCtx());
    await caller.progress.update({ moduleId: 1, status: "completed" });

    const firedComplete = vi.mocked(dbm.createNotification).mock.calls
      .some(c => (c[0] as any)?.type === "onboarding_complete");
    expect(firedComplete).toBe(true);
  });

  it("reopens a completed onboarding when a test-out regresses to needs improvement", async () => {
    const dbm = await import("./db");
    vi.mocked(dbm.getUserById).mockResolvedValue({
      id: 1, name: "Test User", email: "test@reformationchiropractic.com",
      teamRole: "ca", onboardingCompletedAt: new Date(),
    } as any);
    vi.mocked(dbm.getTrackByRole).mockResolvedValue({ id: 5, teamRole: "ca", name: "CA" } as any);
    vi.mocked(dbm.getMilestoneById).mockResolvedValue(null);
    vi.mocked(dbm.areTestOutsMastered).mockResolvedValue(false);
    vi.mocked(dbm.logActivity).mockClear();

    const caller = appRouter.createCaller(makeCtx({}, "admin"));
    await caller.grading.setGrade({ userId: 1, moduleId: 1, milestoneId: 50, grade: "needs_improvement" });

    const reopened = vi.mocked(dbm.logActivity).mock.calls
      .some(c => (c[0] as any)?.eventType === "onboarding_reopened");
    expect(reopened).toBe(true);
  });
});

describe("notifications router", () => {
  it("returns user notifications", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.mine();
    expect(Array.isArray(result)).toBe(true);
  });

  it("marks all notifications as read", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markAllRead();
    expect(result.success).toBe(true);
  });
});

describe("users router — createUser role requirement", () => {
  it("rejects a trainee created without a training role", async () => {
    const ctx = makeCtx({}, "admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.users.createUser({ email: "no-role@reformationchiropractic.com", name: "No Role", password: "password1" })
    ).rejects.toThrow();
  });

  it("allows a trainee created with a training role", async () => {
    const ctx = makeCtx({}, "admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.createUser({
      email: "ca@reformationchiropractic.com", name: "New CA", password: "password1", teamRole: "ca",
    });
    expect(result.success).toBe(true);
  });

  it("allows an admin created without a training role", async () => {
    const ctx = makeCtx({}, "admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.createUser({
      email: "admin2@reformationchiropractic.com", name: "New Admin", password: "password1", role: "admin",
    });
    expect(result.success).toBe(true);
  });
});

describe("admin router", () => {
  it("returns stats for admin users", async () => {
    const ctx = makeCtx({}, "admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.stats();
    expect(result).toBeDefined();
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx({}, "user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});
