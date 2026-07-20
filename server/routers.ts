import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { hashPassword, verifyPassword, generateResetToken, resetTokenExpiresAt, sendPasswordResetEmail, sendWelcomeEmail, sendQuestionNotificationEmail, sendVideoNotificationEmail, sendQuestionAnsweredEmail, sendVideoReviewedEmail, sendQuestionReplyEmail, sendVideoReplyEmail } from "./emailAuth";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";

// ─── Storage Router ─────────────────────────────────────────────────────────
const storageRouter = router({
  presign: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const { presignGetUrl } = await import('./_core/s3');
      const url = await presignGetUrl(input.key.replace(/^\/+/, ''));
      return { url };
    }),
  presignUpload: protectedProcedure
    .input(z.object({ key: z.string(), contentType: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { presignPutUrl } = await import('./_core/s3');
      const hash = Math.random().toString(36).slice(2, 10);
      const lastDot = input.key.lastIndexOf('.');
      const keyWithHash = lastDot === -1
        ? `${input.key}_${hash}`
        : `${input.key.slice(0, lastDot)}_${hash}${input.key.slice(lastDot)}`;
      const url = await presignPutUrl(keyWithHash.replace(/^\/+/, ''), input.contentType);
      return { url, key: keyWithHash, storageUrl: `/manus-storage/${keyWithHash}`, contentType: input.contentType };
    }),
});

// ─── Auth Router ──────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByEmail(input.email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (user.approvalStatus !== "approved") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account is not yet approved." });
      }
      const userOpenId = user.openId ?? `email:${user.email}`;
      const sessionToken = await sdk.createSessionToken(userOpenId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      if (user.openId) await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      return { success: true, user };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByEmail(input.email.toLowerCase().trim());
      if (!user) return { success: true };
      const token = generateResetToken();
      const expiresAt = resetTokenExpiresAt();
      await db.setResetToken(user.id, token, expiresAt);
      const resetUrl = `${input.origin}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email!, user.name ?? "", resetUrl).catch((e) => console.error("[Auth] Reset email failed:", e));
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByResetToken(input.token);
      if (!user || !user.resetTokenExpiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
      if (new Date() > user.resetTokenExpiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Reset token has expired" });
      const hash = await hashPassword(input.newPassword);
      await db.updateUserPassword(user.id, hash);
      await db.clearResetToken(user.id);
      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user || !user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "No password set" });
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      const hash = await hashPassword(input.newPassword);
      await db.updateUserPassword(user.id, hash);
      return { success: true };
    }),
});

// ─── Users Router ─────────────────────────────────────────────────────────────
const usersRouter = router({
  // Admin: list all users
  list: adminProcedure.query(async () => {
    return db.getAllUsers();
  }),

  // Admin: pending approvals
  pending: adminProcedure.query(async () => {
    return db.getPendingUsers();
  }),

  // Admin: approve or reject a user
  approve: adminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["approved", "rejected"]),
      teamRole: z.enum(["ca", "associate_doctor", "scan_tech", "preceptor"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserApproval(input.userId, input.status, ctx.user.id);
      if (input.status === "approved" && input.teamRole) {
        await db.updateUserTeamRole(input.userId, input.teamRole);
      }
      // Notify the user
      const notifType = input.status === "approved" ? "account_approved" : "account_rejected";
      const title = input.status === "approved" ? "Your account has been approved!" : "Account access update";
      const message = input.status === "approved"
        ? "Welcome to Reformation Training Hub! Your account is now active. Please log in to begin your onboarding."
        : "Your account request was not approved at this time. Please contact your manager for more information.";
      await db.createNotification({ userId: input.userId, type: notifType, title, message });
      return { success: true };
    }),

  // Admin: set/update a user's team role
  setRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      teamRole: z.enum(["ca", "associate_doctor", "scan_tech", "preceptor"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateUserTeamRole(input.userId, input.teamRole);
      return { success: true };
    }),

  // Get progress summary for all users (admin dashboard)
  progressSummary: adminProcedure.query(async () => {
    const allUsers = await db.getAllUsers();
    const approved = allUsers.filter(u => u.approvalStatus === "approved" && u.teamRole);
    const summaries = await Promise.all(approved.map(async (user) => {
      const progress = await db.getUserProgress(user.id);
      const completedIds = new Set(progress.filter(p => p.status === "completed").map(p => p.moduleId));
      const track = user.teamRole ? await db.getTrackByRole(user.teamRole) : null;
      let totalModules = 0;
      let currentWeek: number | null = null;
      let currentWeekTotal = 0;
      let currentWeekDone = 0;
      if (track) {
        const mss = await db.getMilestonesByTrack(track.id);
        for (const ms of mss) {
          const mods = await db.getModulesByMilestone(ms.id);
          totalModules += mods.length;
          if (currentWeek === null) {
            const allDone = mods.length > 0 && mods.every(m => completedIds.has(m.id));
            if (!allDone) {
              currentWeek = ms.weekNumber ?? ms.sortOrder;
              currentWeekTotal = mods.length;
              currentWeekDone = mods.filter(m => completedIds.has(m.id)).length;
            }
          }
        }
      }
      const completed = completedIds.size;
      const pct = totalModules > 0 ? Math.round((completed / totalModules) * 100) : 0;
      // Compute effective test-out date (auto-advance weekly)
      let effectiveTestOutDate: Date | null = null;
      if (user.testOutDate) {
        effectiveTestOutDate = new Date(user.testOutDate);
        const now = new Date();
        while (effectiveTestOutDate < now) {
          effectiveTestOutDate = new Date(effectiveTestOutDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }
      const daysUntilTestOut = effectiveTestOutDate
        ? Math.ceil((effectiveTestOutDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      const status: "on_track" | "behind" | "test_out_soon" | "complete" =
        user.onboardingCompletedAt ? "complete"
        : daysUntilTestOut !== null && daysUntilTestOut <= 2 ? "test_out_soon"
        : currentWeekTotal > 0 && currentWeekDone < Math.ceil(currentWeekTotal * 0.5) ? "behind"
        : "on_track";
      return {
        user,
        completedModules: completed,
        totalModules,
        progressPct: pct,
        currentWeek,
        currentWeekDone,
        currentWeekTotal,
        effectiveTestOutDate: effectiveTestOutDate?.toISOString() ?? null,
        daysUntilTestOut,
        status,
        isComplete: user.onboardingCompletedAt !== null,
      };
    }));
    return summaries;
  }),

  // Admin: get detailed week-by-week progress for a single trainee
  traineeDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const progress = await db.getUserProgress(input.userId);
      const completedIds = new Set(progress.filter(p => p.status === "completed").map(p => p.moduleId));
      const inProgressIds = new Set(progress.filter(p => p.status === "in_progress").map(p => p.moduleId));
      const track = user.teamRole ? await db.getTrackByRole(user.teamRole) : null;
      const weeks: Array<{
        milestoneId: number;
        weekNumber: number | null;
        title: string;
        modules: Array<{ id: number; title: string; status: "completed" | "in_progress" | "not_started" }>;
        doneCount: number;
        totalCount: number;
      }> = [];
      if (track) {
        const mss = await db.getMilestonesByTrack(track.id);
        for (const ms of mss) {
          const mods = await db.getModulesByMilestone(ms.id);
          const moduleList = mods.map(m => ({
            id: m.id,
            title: m.title,
            status: completedIds.has(m.id) ? "completed" as const
              : inProgressIds.has(m.id) ? "in_progress" as const
              : "not_started" as const,
          }));
          weeks.push({
            milestoneId: ms.id,
            weekNumber: ms.weekNumber ?? ms.sortOrder,
            title: ms.title,
            modules: moduleList,
            doneCount: moduleList.filter(m => m.status === "completed").length,
            totalCount: moduleList.length,
          });
        }
      }
      const activity = await db.getActivityLogs({ userId: input.userId, limit: 10 });
      return { user, track, weeks, activity };
    }),

  // Admin: create a new user with email/password
  createUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8),
      teamRole: z.enum(["ca", "associate_doctor", "scan_tech", "preceptor"]).optional(),
      role: z.enum(["user", "admin"]).default("user"),
      origin: z.string().url().optional(),
    }).superRefine((val, ctx) => {
      // A trainee with no training role lands on a dead-end screen with nothing
      // to do, so require a role unless the account is an admin (admins have no
      // team role by design). This is the server-side guarantee behind the
      // create-user form's disabled button.
      if (val.role !== "admin" && !val.teamRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamRole"],
          message: "A training role is required for trainees.",
        });
      }
    }))
    .mutation(async ({ input }) => {
      const existing = await db.getUserByEmail(input.email.toLowerCase().trim());
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists" });
      const hash = await hashPassword(input.password);
      const user = await db.createUserWithPassword({
        email: input.email.toLowerCase().trim(),
        name: input.name,
        passwordHash: hash,
        teamRole: input.teamRole ?? null,
        role: input.role,
      });
      // Send welcome email (non-blocking — don't fail user creation if email fails)
      const loginUrl = `${input.origin ?? process.env.PUBLIC_BASE_URL ?? ""}/login`;
      sendWelcomeEmail(
        input.email.toLowerCase().trim(),
        input.name,
        input.password,
        loginUrl
      ).catch(err => console.error("[Welcome email failed]", err));
      return { success: true, user };
    }),

  // Admin: update user name/email/role
  updateUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      teamRole: z.enum(["ca", "associate_doctor", "scan_tech", "preceptor"]).optional(),
      role: z.enum(["user", "admin"]).optional(),
      testOutDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.teamRole) await db.updateUserTeamRole(input.userId, input.teamRole);
      if (input.testOutDate !== undefined) {
        await db.updateUserTestOutDate(input.userId, input.testOutDate ? new Date(input.testOutDate) : null);
      }
      return { success: true };
    }),

  // Admin: reset a user's password directly
  adminResetPassword: adminProcedure
    .input(z.object({ userId: z.number(), newPassword: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const hash = await hashPassword(input.newPassword);
      await db.updateUserPassword(input.userId, hash);
      return { success: true };
    }),

  // Admin: delete a user
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
      await db.deleteUser(input.userId);
      return { success: true };
    }),

  // Admin: resend welcome email
  resendInvite: adminProcedure
    .input(z.object({ userId: z.number(), origin: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "User has no email address" });
      sendWelcomeEmail(user.name ?? "Team Member", user.email, "(your existing password)", `${input.origin}/login`).catch(() => {});
      return { success: true };
    }),
});

// ─── SOPs Router ──────────────────────────────────────────────────────────────
const sopsRouter = router({
  categories: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "Account pending approval" });
    return db.getSopCategories();
  }),

  byCategory: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getSopsByCategory(input.categoryId);
    }),

  all: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
    return db.getAllSops();
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const sop = await db.getSopById(input.id);
      if (!sop) throw new TRPCError({ code: "NOT_FOUND" });
      return sop;
    }),

  versions: protectedProcedure
    .input(z.object({ sopId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getSopVersions(input.sopId);
    }),

  markReviewed: protectedProcedure
    .input(z.object({ sopId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.markSopReviewed(ctx.user.id, input.sopId);
      return { success: true };
    }),

  myReviewFlags: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserSopReviewFlags(ctx.user.id);
  }),
});

// ─── Tracks Router ────────────────────────────────────────────────────────────
const tracksRouter = router({
  all: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
    return db.getTracks();
  }),

  myTrack: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
    if (!ctx.user.teamRole) return null;
    const track = await db.getTrackByRole(ctx.user.teamRole);
    if (!track) return null;
    const mss = await db.getMilestonesByTrack(track.id);
    const milestonesWithModules = await Promise.all(mss.map(async (ms) => {
      const mods = await db.getModulesByMilestone(ms.id);
      const progress = await Promise.all(mods.map(async (mod) => {
        const p = await db.getModuleProgress(ctx.user.id, mod.id);
        return { ...mod, progress: p ?? null };
      }));
      return { ...ms, modules: progress };
    }));
    return { ...track, milestones: milestonesWithModules };
  }),

  milestones: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getMilestonesByTrack(input.trackId);
    }),

  modules: protectedProcedure
    .input(z.object({ milestoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getModulesByMilestone(input.milestoneId);
    }),

  moduleById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const mod = await db.getModuleById(input.id);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });
      // Fetch SOP if linked
      let sop = null;
      if (mod.sopId) sop = await db.getSopById(mod.sopId);
      // Fetch quiz if exists
      const quiz = await db.getQuizByModuleId(mod.id);
      // Fetch user progress
      const progress = await db.getModuleProgress(ctx.user.id, mod.id);
      // Fetch quiz attempts
      const attempts = await db.getQuizAttempts(ctx.user.id, mod.id);
      return { ...mod, sop, quiz, progress: progress ?? null, attempts };
    }),

  adjacentModules: protectedProcedure
    .input(z.object({ moduleId: z.number(), trackId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.user.role === "admin";
      if (!isAdmin && ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const mod = await db.getModuleById(input.moduleId);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });
      // Determine track: explicit trackId > teamRole > derive from module's milestone (admin fallback)
      let track;
      if (input.trackId) {
        const allTracks = await db.getTracks();
        track = allTracks.find(t => t.id === input.trackId);
      } else if (ctx.user.teamRole) {
        track = await db.getTrackByRole(ctx.user.teamRole);
      } else if (isAdmin) {
        // Admin with no teamRole: derive track from the module's milestone
        const allTracks = await db.getTracks();
        outer: for (const t of allTracks) {
          const milestones = await db.getMilestonesByTrack(t.id);
          for (const ms of milestones) {
            if (ms.id === mod.milestoneId) { track = t; break outer; }
          }
        }
      } else {
        return { prev: null, next: null, currentIndex: null, totalCount: null, weekLabel: null, weekNumber: null };
      }
      if (!track) return { prev: null, next: null, currentIndex: null, totalCount: null, weekLabel: null, weekNumber: null };
      const milestones = await db.getMilestonesByTrack(track.id);
      // Flatten all modules across all milestones in order, carrying week info
      const allModules: { id: number; title: string; weekLabel: string; weekNumber: number }[] = [];
      for (const ms of milestones) {
        const mods = await db.getModulesByMilestone(ms.id);
        allModules.push(...mods.map(m => ({ id: m.id, title: m.title, weekLabel: ms.title, weekNumber: ms.weekNumber })));
      }
      const idx = allModules.findIndex(m => m.id === input.moduleId);
      const current = allModules[idx];
      return {
        prev: idx > 0 ? allModules[idx - 1] : null,
        next: idx >= 0 && idx < allModules.length - 1 ? allModules[idx + 1] : null,
        currentIndex: idx + 1,
        totalCount: allModules.length,
        weekLabel: current?.weekLabel ?? null,
        weekNumber: current?.weekNumber ?? null,
      };
    }),

  // ── Global module search ──
  searchModules: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      // Admins with no teamRole search all tracks; others search their assigned track only
      let mss: Awaited<ReturnType<typeof db.getMilestonesByTrack>> = [];
      if (!ctx.user.teamRole) {
        if (ctx.user.role !== "admin") return [];
        const allTracks = await db.getTracks();
        const allMss = await Promise.all(allTracks.map(t => db.getMilestonesByTrack(t.id)));
        mss = allMss.flat();
      } else {
        const track = await db.getTrackByRole(ctx.user.teamRole);
        if (!track) return [];
        mss = await db.getMilestonesByTrack(track.id);
      }
      const q = input.query.toLowerCase();
      const results: { id: number; title: string; type: string; weekLabel: string; milestoneId: number }[] = [];
      for (const ms of mss) {
        const mods = await db.getModulesByMilestone(ms.id);
        for (const mod of mods) {
          if (
            mod.title.toLowerCase().includes(q) ||
            (mod.description ?? "").toLowerCase().includes(q)
          ) {
            results.push({
              id: mod.id,
              title: mod.title,
              type: mod.type,
              weekLabel: ms.title,
              milestoneId: ms.id,
            });
          }
        }
      }
      return results.slice(0, 20);
    }),

  // ── Admin: full track with all milestones+modules (no progress) ──
  adminTrack: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const allTracks = await db.getTracks();
      const track = allTracks.find(t => t.id === input.trackId);
      if (!track) throw new TRPCError({ code: "NOT_FOUND" });
      const mss = await db.getMilestonesByTrack(track.id);
      const milestonesWithModules = await Promise.all(mss.map(async (ms) => {
        const mods = await db.getModulesByMilestone(ms.id);
        return { ...ms, modules: mods };
      }));
      return { ...track, milestones: milestonesWithModules };
    }),

  // ── Admin: update track name/description ──
  updateTrack: protectedProcedure
    .input(z.object({ trackId: z.number(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { tracks: tracksTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db2.update(tracksTable).set({ name: input.name, description: input.description ?? null }).where(eq(tracksTable.id, input.trackId));
      return { ok: true };
    }),

  // ── Admin: add week (milestone) ──
  addWeek: protectedProcedure
    .input(z.object({ trackId: z.number(), title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { milestones: milestonesTable } = await import("../drizzle/schema");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.getMilestonesByTrack(input.trackId);
      const maxWeek = existing.reduce((m, ms) => Math.max(m, ms.weekNumber), 0);
      const maxSort = existing.reduce((m, ms) => Math.max(m, ms.sortOrder ?? 0), 0);
      const [result] = await db2.insert(milestonesTable).values({
        trackId: input.trackId, title: input.title,
        description: input.description ?? null,
        weekNumber: maxWeek + 1, sortOrder: maxSort + 1,
      });
      return { id: (result as any).insertId };
    }),

  // ── Admin: update week (milestone) ──
  updateWeek: protectedProcedure
    .input(z.object({ milestoneId: z.number(), title: z.string().min(1), description: z.string().optional(), weekNumber: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { milestones: milestonesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db2.update(milestonesTable).set({
        title: input.title,
        description: input.description ?? null,
        ...(input.weekNumber !== undefined ? { weekNumber: input.weekNumber } : {}),
      }).where(eq(milestonesTable.id, input.milestoneId));
      return { ok: true };
    }),

  // ── Admin: delete week and all its modules ──
  deleteWeek: protectedProcedure
    .input(z.object({ milestoneId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { milestones: milestonesTable, modules: modulesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db2.delete(modulesTable).where(eq(modulesTable.milestoneId, input.milestoneId));
      await db2.delete(milestonesTable).where(eq(milestonesTable.id, input.milestoneId));
      return { ok: true };
    }),

  // ── Admin: add module ──
  addModule: protectedProcedure
    .input(z.object({
      milestoneId: z.number(),
      title: z.string().min(1),
      type: z.enum(["sop", "video", "task", "checklist"]),
      description: z.string().optional(),
      loomUrl: z.string().optional(),
      taskInstructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { modules: modulesTable } = await import("../drizzle/schema");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.getModulesByMilestone(input.milestoneId);
      const maxSort = existing.reduce((m, mod) => Math.max(m, mod.sortOrder ?? 0), 0);
      const [result] = await db2.insert(modulesTable).values({
        milestoneId: input.milestoneId, title: input.title, type: input.type,
        description: input.description ?? null, loomUrl: input.loomUrl ?? null,
        taskInstructions: input.taskInstructions ?? null,
        sortOrder: maxSort + 1, isRequired: true, quizEnabled: false,
      });
      return { id: (result as any).insertId };
    }),

  // ── Admin: update module ──
  updateModule: protectedProcedure
    .input(z.object({
      moduleId: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      type: z.enum(["sop", "video", "task", "checklist"]).optional(),
      loomUrl: z.string().nullable().optional(),
      loomUrl2: z.string().nullable().optional(),
      taskInstructions: z.string().nullable().optional(),
      isRequired: z.boolean().optional(),
      quizEnabled: z.boolean().optional(),
      milestoneId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { modules: modulesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { moduleId, ...fields } = input;
      const update: Record<string, unknown> = {};
      if (fields.title !== undefined) update.title = fields.title;
      if (fields.description !== undefined) update.description = fields.description;
      if (fields.type !== undefined) update.type = fields.type;
      if (fields.loomUrl !== undefined) update.loomUrl = fields.loomUrl;
      if (fields.loomUrl2 !== undefined) update.loomUrl2 = fields.loomUrl2;
      if (fields.taskInstructions !== undefined) update.taskInstructions = fields.taskInstructions;
      if (fields.isRequired !== undefined) update.isRequired = fields.isRequired;
      if (fields.quizEnabled !== undefined) update.quizEnabled = fields.quizEnabled;
      if (fields.milestoneId !== undefined) update.milestoneId = fields.milestoneId;
      await db2.update(modulesTable).set(update).where(eq(modulesTable.id, moduleId));
      return { ok: true };
    }),

  // ── Admin: delete module ──
  deleteModule: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { modules: modulesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db2.delete(modulesTable).where(eq(modulesTable.id, input.moduleId));
      return { ok: true };
    }),

  // ── Admin: reorder modules within a milestone ──
  reorderModules: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { modules: modulesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.orderedIds.map((id, idx) =>
        db2.update(modulesTable).set({ sortOrder: idx }).where(eq(modulesTable.id, id))
      ));
      return { ok: true };
    }),

  // ── Module SOP links ──
  getModuleSops: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ input }) => {
      return db.getModuleSops(input.moduleId);
    }),

  // ── Admin: reorder weeks within a track ──
  reorderWeeks: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { milestones: milestonesTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.orderedIds.map((id, idx) =>
        db2.update(milestonesTable).set({ sortOrder: idx, weekNumber: idx + 1 }).where(eq(milestonesTable.id, id))
      ));
      return { ok: true };
    }),
});

// ─── Progress Router ──────────────────────────────────────────────────────────
const progressRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserProgress(ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({
      moduleId: z.number(),
      status: z.enum(["not_started", "in_progress", "completed", "needs_review"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const completedAt = input.status === "completed" ? new Date() : undefined;
      await db.upsertModuleProgress(ctx.user.id, input.moduleId, input.status, completedAt);
      // Activity log
      if (input.status === "completed") {
        await db.logActivity({ userId: ctx.user.id, eventType: "module_completed", description: `Completed module ID ${input.moduleId}`, moduleId: input.moduleId });
      } else if (input.status === "in_progress") {
        await db.logActivity({ userId: ctx.user.id, eventType: "module_started", description: `Started module ID ${input.moduleId}`, moduleId: input.moduleId });
      }

      // Check if all modules in track are complete
      if (input.status === "completed" && ctx.user.teamRole) {
        const track = await db.getTrackByRole(ctx.user.teamRole);
        if (track) {
          const mss = await db.getMilestonesByTrack(track.id);
          let totalModules = 0;
          const allModuleIds: number[] = [];
          for (const ms of mss) {
            const mods = await db.getModulesByMilestone(ms.id);
            totalModules += mods.length;
            allModuleIds.push(...mods.map(m => m.id));
          }
          const progress = await db.getUserProgress(ctx.user.id);
          const completedCount = progress.filter(p => p.status === "completed" && allModuleIds.includes(p.moduleId)).length;
          if (completedCount === totalModules) {
            // Mark onboarding complete
            const dbConn = await db.getDb();
            if (dbConn) {
              const { users } = await import("../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              await dbConn.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, ctx.user.id));
            }
            await notifyOwner({
              title: `🎉 ${ctx.user.name} completed onboarding!`,
              content: `${ctx.user.name} (${ctx.user.email}) has completed their full ${ctx.user.teamRole} onboarding track.`,
            });
            await db.createNotification({
              userId: ctx.user.id,
              type: "onboarding_complete",
              title: "Congratulations! You've completed onboarding.",
              message: "You have successfully completed all modules in your onboarding track. Welcome to the Reformation team!",
            });
          }
        }
      }
      return { success: true };
    }),
});

// ─── Quiz Router ──────────────────────────────────────────────────────────────
const quizRouter = router({
  generate: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const mod = await db.getModuleById(input.moduleId);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });

      // Gate: only generate quiz if quizEnabled is true on this module
      if (!mod.quizEnabled) throw new TRPCError({ code: "FORBIDDEN", message: "Quiz not enabled for this module" });

      // Check if quiz already exists
      const existing = await db.getQuizByModuleId(input.moduleId);
      if (existing) return existing;

      // Get SOP content for context
      let context = mod.title;
      if (mod.sopId) {
        const sop = await db.getSopById(mod.sopId);
        if (sop) context = sop.content.slice(0, 3000);
      }

      // Generate quiz with LLM
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a training quiz generator for Reformation Chiropractic, a nervous system-focused Gonstead chiropractic practice. 
Generate exactly 4 multiple-choice questions to test comprehension of the provided SOP content.
Each question must have exactly 4 answer options (A, B, C, D) with exactly one correct answer.
Questions should test practical understanding, not just memorization.
Return ONLY valid JSON matching this exact schema:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Generate a quiz for this SOP module titled "${mod.title}":\n\n${context}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quiz_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correctIndex: { type: "integer" },
                      explanation: { type: "string" },
                    },
                    required: ["id", "question", "options", "correctIndex", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : null;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate quiz" });
      const parsed = JSON.parse(content);
      await db.upsertQuiz(input.moduleId, parsed.questions, 75);
      return db.getQuizByModuleId(input.moduleId);
    }),

  byModule: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const mod = await db.getModuleById(input.moduleId);
      if (!mod || !mod.quizEnabled) return null;
      return db.getQuizByModuleId(input.moduleId);
    }),

  submit: protectedProcedure
    .input(z.object({
      moduleId: z.number(),
      quizId: z.number(),
      answers: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.approvalStatus !== "approved") throw new TRPCError({ code: "FORBIDDEN" });
      const quiz = await db.getQuizByModuleId(input.moduleId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      const questions = quiz.questions as Array<{ id: number; correctIndex: number }>;
      let correct = 0;
      for (let i = 0; i < questions.length; i++) {
        if (input.answers[i] === questions[i].correctIndex) correct++;
      }
      const score = Math.round((correct / questions.length) * 100);
      const passed = score >= quiz.passingScore;

      await db.saveQuizAttempt({
        userId: ctx.user.id,
        quizId: quiz.id,
        moduleId: input.moduleId,
        answers: input.answers,
        score,
        passed,
      });

      // Update module progress
      if (passed) {
        await db.upsertModuleProgress(ctx.user.id, input.moduleId, "completed", new Date());
        await db.logActivity({ userId: ctx.user.id, eventType: "quiz_passed", description: `Passed quiz with ${score}% on module ID ${input.moduleId}`, moduleId: input.moduleId, metadata: { score, correct, total: questions.length } });
      } else {
        await db.logActivity({ userId: ctx.user.id, eventType: "quiz_failed", description: `Failed quiz with ${score}% on module ID ${input.moduleId}`, moduleId: input.moduleId, metadata: { score, correct, total: questions.length } });
        await db.upsertModuleProgress(ctx.user.id, input.moduleId, "in_progress");
        // Notify admin of failed quiz
        await notifyOwner({
          title: `Quiz failed: ${ctx.user.name}`,
          content: `${ctx.user.name} scored ${score}% on the quiz for module ID ${input.moduleId}. Passing score is ${quiz.passingScore}%.`,
        });
        await db.createNotification({
          userId: ctx.user.id,
          type: "quiz_failed",
          title: "Quiz not passed — try again",
          message: `You scored ${score}% on this quiz. The passing score is ${quiz.passingScore}%. Review the material and try again.`,
          relatedId: input.moduleId,
        });
      }

      return { score, passed, correct, total: questions.length };
    }),

  myAttempts: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getQuizAttempts(ctx.user.id, input.moduleId);
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────
const notificationsRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserNotifications(ctx.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
const adminRouter = router({
  stats: adminProcedure.query(async () => {
    return db.getAdminStats();
  }),

  // Run the Google Drive SOP sync on demand (also runs weekly via cron).
  syncSops: adminProcedure.mutation(async () => {
    const { syncSopsFromDrive } = await import("./scheduledSopSync");
    const result = await syncSopsFromDrive();
    return { success: result.errors.length === 0, ...result };
  }),

  // ── New Hire Prep Checklist ──────────────────────────────────────────────
  getPrepChecklist: adminProcedure
    .input(z.object({ newHireUserId: z.number() }))
    .query(async ({ input, ctx }) => {
      return db.getPrepChecklist(input.newHireUserId);
    }),

  upsertPrepChecklist: adminProcedure
    .input(z.object({
      newHireUserId: z.number(),
      items: z.array(z.object({
        key: z.string(),
        label: z.string(),
        completed: z.boolean(),
        completedAt: z.string().nullable(),
        note: z.string().optional(),
      })),
      binderSopIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.upsertPrepChecklist({
        newHireUserId: input.newHireUserId,
        adminUserId: ctx.user!.id,
        items: input.items,
        binderSopIds: input.binderSopIds ?? [],
      });
    }),

  // Get SOPs for binder selection (all active SOPs with category)
  getSopsForBinder: adminProcedure.query(async () => {
    return db.getAllSopsWithCategory();
  }),

  // ── One-time: import training content from the old (Manus) database ──────────
  // The admin pastes the old MySQL/TiDB connection string. This server can reach
  // both databases, so it copies the reusable content — tracks, weeks, modules,
  // quizzes — into this database, preserving IDs so the links between them stay
  // intact. Per-user history (progress, quiz attempts, grades) is intentionally
  // left behind. Guarded: refuses if any tracks already exist, so it can never
  // double-import, and runs in a transaction so it's all-or-nothing.
  importFromOldDb: adminProcedure
    .input(z.object({ connectionString: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await db.getTracks();
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "This database already has tracks — import is disabled to avoid duplicates." });
      }
      const db2 = await db.getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available." });

      const schema = await import("../drizzle/schema");
      const mysql = await import("mysql2/promise");

      let url: URL;
      try { url = new URL(input.connectionString.trim()); }
      catch { throw new TRPCError({ code: "BAD_REQUEST", message: "That doesn't look like a valid connection string." }); }

      // Parse a JSON string back to an object (mysql may return JSON columns as
      // strings); leave anything else untouched.
      const norm = (v: any) => {
        if (v === undefined || v === null) return null;
        if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
        return v;
      };
      const bool = (v: any, d: boolean) => (v === undefined || v === null ? d : !!v);

      let old: any;
      try {
        old = await mysql.createConnection({
          host: url.hostname, port: Number(url.port) || 3306,
          user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
          database: url.pathname.slice(1),
          ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
          connectTimeout: 20000,
        });
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Couldn't connect to the old database: ${e.code || e.message}` });
      }

      try {
        const read = async (t: string) => {
          const [rows] = await old.query("SELECT * FROM `" + t + "`");
          return rows as any[];
        };
        const oTracks = await read("tracks");
        const oMs = await read("milestones");
        const oMods = await read("modules");
        const oQuiz = await read("quizzes");

        await db2.transaction(async (tx: any) => {
          if (oTracks.length) await tx.insert(schema.tracks).values(oTracks.map((r) => ({
            id: r.id, teamRole: r.teamRole, name: r.name,
            description: r.description ?? null, createdAt: r.createdAt ?? new Date(),
          })));
          if (oMs.length) await tx.insert(schema.milestones).values(oMs.map((r) => ({
            id: r.id, trackId: r.trackId, title: r.title, description: r.description ?? null,
            weekNumber: r.weekNumber, dueDay: r.dueDay ?? null, sortOrder: r.sortOrder ?? 0,
            createdAt: r.createdAt ?? new Date(),
          })));
          if (oMods.length) await tx.insert(schema.modules).values(oMods.map((r) => ({
            id: r.id, milestoneId: r.milestoneId, title: r.title, description: r.description ?? null,
            type: r.type, sopId: r.sopId ?? null, loomUrl: r.loomUrl ?? null, loomUrl2: r.loomUrl2 ?? null,
            loomVideoId: r.loomVideoId ?? null, taskInstructions: r.taskInstructions ?? null,
            audioFiles: norm(r.audioFiles), sortOrder: r.sortOrder ?? 0,
            isRequired: bool(r.isRequired, true), quizEnabled: bool(r.quizEnabled, false),
            createdAt: r.createdAt ?? new Date(), updatedAt: r.updatedAt ?? new Date(),
          })));
          if (oQuiz.length) await tx.insert(schema.quizzes).values(oQuiz.map((r) => ({
            id: r.id, moduleId: r.moduleId, questions: norm(r.questions),
            passingScore: r.passingScore ?? 70, createdAt: r.createdAt ?? new Date(), updatedAt: r.updatedAt ?? new Date(),
          })));
        });

        return {
          success: true,
          imported: { tracks: oTracks.length, weeks: oMs.length, modules: oMods.length, quizzes: oQuiz.length },
          trackNames: oTracks.map((t) => t.name as string),
        };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Import failed: ${e.sqlMessage || e.message}` });
      } finally {
        try { await old.end(); } catch { /* ignore */ }
      }
    }),
});

// ─── Scheduled Task Endpoint ──────────────────────────────────────────────────
// This endpoint is called by the monthly scheduled task to update SOPs
const scheduledRouter = router({
  sopSync: protectedProcedure
    .input(z.object({
      sops: z.array(z.object({
        googleDocId: z.string(),
        title: z.string(),
        content: z.string(),
        categorySlug: z.string(),
        lastUpdated: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const categories = await db.getSopCategories();
      const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));
      let updated = 0;
      let added = 0;
      for (const sopData of input.sops) {
        const catId = catMap[sopData.categorySlug];
        if (!catId) continue;
        const existing = await db.getSopByGoogleDocId(sopData.googleDocId);
        if (existing && existing.content !== sopData.content) {
          await db.upsertSop({ ...sopData, categoryId: catId, lastUpdated: new Date(sopData.lastUpdated) });
          await db.flagSopForAllUsers(existing.id, "SOP updated — please re-review");
          updated++;
        } else if (!existing) {
          await db.upsertSop({ ...sopData, categoryId: catId, lastUpdated: new Date(sopData.lastUpdated) });
          added++;
        }
      }
      return { success: true, updated, added };
    }),
});

// ─── Test Out Grades Router ─────────────────────────────────────────────────
const gradingRouter = router({
  // Admin: set a grade for a user's test-out module
  setGrade: adminProcedure
    .input(z.object({
      userId: z.number(),
      moduleId: z.number(),
      milestoneId: z.number(),
      grade: z.enum(["mastered", "needs_improvement"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find the next test-out milestone (next week's test out) if needs_improvement
      let carriedToMilestoneId: number | null = null;
      if (input.grade === "needs_improvement") {
        // Get the current milestone to find its track and weekNumber
        const currentMs = await db.getMilestoneById(input.milestoneId);
        if (currentMs) {
          // Find the next test-out milestone in the same track after this week
          const allMilestones = await db.getMilestonesByTrack(currentMs.trackId);
          const TEST_OUT_KEYWORDS = ["test out", "check-in", "check in", "60-day", "60 day"];
          const nextTestOut = allMilestones
            .filter(ms =>
              ms.weekNumber > currentMs.weekNumber &&
              TEST_OUT_KEYWORDS.some(k => ms.title.toLowerCase().includes(k))
            )
            .sort((a, b) => a.weekNumber - b.weekNumber)[0];
          if (nextTestOut) carriedToMilestoneId = nextTestOut.id;
        }
      }
      const gradeResult = await db.setTestOutGrade({
        userId: input.userId,
        moduleId: input.moduleId,
        milestoneId: input.milestoneId,
        grade: input.grade,
        gradedBy: ctx.user.id,
        carriedToMilestoneId,
      });
      await db.logActivity({ userId: input.userId, eventType: "test_out_graded", description: `Test-out graded: ${input.grade === "mastered" ? "Mastered" : "Needs Improvement"} on milestone ID ${input.milestoneId}`, moduleId: input.moduleId, milestoneId: input.milestoneId, metadata: { grade: input.grade, gradedBy: ctx.user.id } });
      return gradeResult;
    }),

  // Get all grades for a specific user (admin or self)
  getForUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Allow admin or the user themselves
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getTestOutGradesForUser(input.userId);
    }),

  // Get grades for a specific milestone + user
  getForMilestone: protectedProcedure
    .input(z.object({ userId: z.number(), milestoneId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getTestOutGradesForMilestone(input.userId, input.milestoneId);
    }),
});
// ─── Daily Focus Router ───────────────────────────────────────────────────────
const dailyFocusRouter = router({
  // Get today's checkins
  todayCheckins: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    return db.getDailyCheckins(ctx.user.id, today);
  }),
  // Toggle a module checkoff for today
  toggle: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10);
      return db.toggleDailyCheckin(ctx.user.id, input.moduleId, today);
    }),
});
// ─── Software Checklist Router ─────────────────────────────────────────────
const softwareChecklistRouter = router({
  getItems: protectedProcedure
    .input(z.object({ userId: z.number(), moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getSoftwareChecklist(input.userId, input.moduleId);
    }),
  toggleItem: protectedProcedure
    .input(z.object({ userId: z.number(), moduleId: z.number(), softwareName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const swResult = await db.toggleSoftwareItem(input.userId, input.moduleId, input.softwareName, ctx.user.id);
      if (swResult.isChecked) {
        await db.logActivity({ userId: input.userId, eventType: "software_access_granted", description: `Software access confirmed: ${input.softwareName}`, moduleId: input.moduleId, metadata: { softwareName: input.softwareName, grantedBy: ctx.user.id } });
      }
      return swResult;
    }),
});

// ─── Module Task Items Router ─────────────────────────────────────────────
const moduleTaskItemsRouter = router({
  getItems: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getModuleTaskItems(ctx.user.id, input.moduleId);
    }),
  toggleItem: protectedProcedure
    .input(z.object({
      moduleId: z.number(),
      itemIndex: z.number(),
      itemText: z.string(),
      isChecked: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertModuleTaskItem(ctx.user.id, input.moduleId, input.itemIndex, input.itemText, input.isChecked);
      const items = await db.getModuleTaskItems(ctx.user.id, input.moduleId);
      const allChecked = items.length > 0 && items.every(i => i.isChecked);
      return { allChecked };
    }),
});

// ─── Activity Log Router ─────────────────────────────────────────────────────
const activityLogRouter = router({
  list: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return db.getActivityLogs({ userId: input.userId, limit: input.limit, offset: input.offset });
    }),
});
// ─── Submissions Router ───────────────────────────────────────────────────────
const submissionsRouter = router({
  // Trainee: submit a question
  submitQuestion: protectedProcedure
    .input(z.object({
      question: z.string().min(1).max(2000),
      moduleId: z.number().optional(),
      moduleName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const q = await db.submitQuestion({
        userId: ctx.user.id,
        moduleId: input.moduleId ?? null,
        moduleName: input.moduleName ?? null,
        question: input.question,
      });
      if (!q) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Notify all admins (in-app)
      const admins = await db.getAdminUsers();
      for (const admin of admins) {
        await db.createNotification({
          userId: admin.id,
          type: 'question_submitted',
          title: 'New Question Submitted',
          message: `${ctx.user.name ?? 'A trainee'} submitted a question: "${input.question.slice(0, 80)}${input.question.length > 80 ? '...' : ''}"`,
          relatedId: q.id,
        });
      }
      // Email notification to owner — fire-and-forget so a slow/blocked email
      // never holds up the trainee's submission (in-app notification already sent).
      sendQuestionNotificationEmail(
        ctx.user.email ?? '',
        ctx.user.name ?? 'A trainee',
        input.question,
        input.moduleName ?? null,
        q.id
      ).catch((e) => console.error('[Submissions] Question email notification failed:', e));
      return q;
    }),

  // Trainee: get my questions
  myQuestions: protectedProcedure.query(async ({ ctx }) => {
    return db.getQuestionsForUser(ctx.user.id);
  }),

  // Admin: get all questions
  allQuestions: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return db.getAllQuestions({ limit: input.limit, offset: input.offset });
    }),

  // Admin: reply to a question
  replyQuestion: adminProcedure
    .input(z.object({
      questionId: z.number(),
      reply: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.replyToQuestion({
        questionId: input.questionId,
        reply: input.reply,
        repliedBy: ctx.user.id,
      });
      // Notify the trainee
      const q = await db.getQuestionById(input.questionId);
      if (q) {
        await db.createNotification({
          userId: q.userId,
          type: 'question_answered',
          title: 'Your Question Was Answered',
          message: `${ctx.user.name ?? 'Leadership'} replied to your question: "${q.question.slice(0, 60)}${q.question.length > 60 ? '...' : ''}"`,
          relatedId: input.questionId,
        });
        // Email the trainee
        const trainee = await db.getUserById(q.userId);
        if (trainee?.email) {
          sendQuestionAnsweredEmail(
            trainee.email,
            trainee.name ?? 'Trainee',
            q.question,
            input.reply,
            ctx.user.name ?? 'Leadership'
          ).catch((e) => console.error('[Submissions] Question answered email failed:', e));
        }
      }
      return { success: true };
    }),

  // Trainee: submit a video (after upload to S3)
  submitVideo: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      moduleId: z.number().optional(),
      moduleName: z.string().optional(),
      fileKey: z.string(),
      fileUrl: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const v = await db.createVideoSubmission({
        userId: ctx.user.id,
        moduleId: input.moduleId ?? null,
        moduleName: input.moduleName ?? null,
        title: input.title,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
      });
      if (!v) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Notify all admins (in-app)
      const admins = await db.getAdminUsers();
      for (const admin of admins) {
        await db.createNotification({
          userId: admin.id,
          type: 'video_submitted',
          title: 'New Script Video Submitted',
          message: `${ctx.user.name ?? 'A trainee'} submitted a video for review: "${input.title}"`,
          relatedId: v.id,
        });
      }
      // Email notification to owner — fire-and-forget so a slow/blocked email
      // never holds up the trainee's submission (in-app notification already sent).
      sendVideoNotificationEmail(
        ctx.user.email ?? '',
        ctx.user.name ?? 'A trainee',
        input.title,
        input.moduleName ?? null,
        v.id
      ).catch((e) => console.error('[Submissions] Video email notification failed:', e));
      return v;
    }),

  // Trainee: get my video submissions
  myVideos: protectedProcedure.query(async ({ ctx }) => {
    return db.getVideoSubmissionsForUser(ctx.user.id);
  }),

  // Admin: get all video submissions
  allVideos: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      return db.getAllVideoSubmissions({ limit: input.limit, offset: input.offset });
    }),

  // Both: get replies for a question thread
  getQuestionReplies: protectedProcedure
    .input(z.object({ questionId: z.number() }))
    .query(async ({ input }) => {
      return db.getQuestionReplies(input.questionId);
    }),

  // Both: add a reply to a question thread
  addQuestionReply: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      message: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('[DEBUG addQuestionReply] userId:', ctx.user.id, 'email:', ctx.user.email, 'questionId:', input.questionId);
      let reply;
      try {
        reply = await db.addQuestionReply({
          questionId: input.questionId,
          userId: ctx.user.id,
          message: input.message,
        });
      } catch (dbErr) {
        console.error('[DEBUG addQuestionReply] DB error:', dbErr);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: String(dbErr) });
      }
      if (!reply) {
        console.error('[DEBUG addQuestionReply] reply is null after insert');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
      // Notify the other party — all side effects are non-fatal
      try {
        const q = await db.getQuestionById(input.questionId);
        if (q) {
          const isAdmin = ctx.user.role === 'admin';
          if (isAdmin) {
            await db.createNotification({
              userId: q.userId,
              type: 'question_answered',
              title: 'New Reply to Your Question',
              message: `${ctx.user.name ?? 'Leadership'} replied to your question`,
              relatedId: input.questionId,
            });
            const trainee = await db.getUserById(q.userId);
            if (trainee?.email) {
              sendQuestionReplyEmail({
                toEmail: trainee.email,
                toName: trainee.name ?? 'Trainee',
                fromName: ctx.user.name ?? 'Leadership',
                questionId: input.questionId,
                questionText: q.question,
                replyMessage: input.message,
                isAdmin: true,
              }).catch(e => console.error('[Submissions] Question reply email failed:', e));
            }
          } else {
            const admins = await db.getAdminUsers();
            for (const admin of admins) {
              await db.createNotification({
                userId: admin.id,
                type: 'question_submitted',
                title: 'Trainee Replied to Question',
                message: `${ctx.user.name ?? 'A trainee'} replied to a question thread`,
                relatedId: input.questionId,
              });
              if (admin.email) {
                sendQuestionReplyEmail({
                  toEmail: admin.email,
                  toName: admin.name ?? 'Admin',
                  fromName: ctx.user.name ?? 'Trainee',
                  questionId: input.questionId,
                  questionText: q.question,
                  replyMessage: input.message,
                  isAdmin: false,
                }).catch(e => console.error('[Submissions] Question reply email failed:', e));
              }
            }
          }
        }
      } catch (e) {
        console.error('[Submissions] addQuestionReply side-effect error:', e);
      }
      return reply;
    }),

  // Both: get replies for a video thread
  getVideoReplies: protectedProcedure
    .input(z.object({ videoSubmissionId: z.number() }))
    .query(async ({ input }) => {
      return db.getVideoReplies(input.videoSubmissionId);
    }),

  // Both: add a reply to a video thread
  addVideoReply: protectedProcedure
    .input(z.object({
      videoSubmissionId: z.number(),
      message: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const reply = await db.addVideoReply({
        videoSubmissionId: input.videoSubmissionId,
        userId: ctx.user.id,
        message: input.message,
      });
      if (!reply) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Notify the other party — all side effects are non-fatal
      try {
        const v = await db.getVideoSubmissionById(input.videoSubmissionId);
        if (v) {
          const isAdmin = ctx.user.role === 'admin';
          if (isAdmin) {
            await db.createNotification({
              userId: v.userId,
              type: 'video_reviewed',
              title: 'New Reply on Your Video',
              message: `${ctx.user.name ?? 'Leadership'} replied to your video submission`,
              relatedId: input.videoSubmissionId,
            });
            const trainee = await db.getUserById(v.userId);
            if (trainee?.email) {
              sendVideoReplyEmail({
                toEmail: trainee.email,
                toName: trainee.name ?? 'Trainee',
                fromName: ctx.user.name ?? 'Leadership',
                videoSubmissionId: input.videoSubmissionId,
                videoTitle: v.title,
                replyMessage: input.message,
                isAdmin: true,
              }).catch(e => console.error('[Submissions] Video reply email failed:', e));
            }
          } else {
            const admins = await db.getAdminUsers();
            for (const admin of admins) {
              await db.createNotification({
                userId: admin.id,
                type: 'video_submitted',
                title: 'Trainee Replied to Video Submission',
                message: `${ctx.user.name ?? 'A trainee'} replied to a video submission`,
                relatedId: input.videoSubmissionId,
              });
              if (admin.email) {
                sendVideoReplyEmail({
                  toEmail: admin.email,
                  toName: admin.name ?? 'Admin',
                  fromName: ctx.user.name ?? 'Trainee',
                  videoSubmissionId: input.videoSubmissionId,
                  videoTitle: v.title,
                  replyMessage: input.message,
                  isAdmin: false,
                }).catch(e => console.error('[Submissions] Video reply email failed:', e));
              }
            }
          }
        }
      } catch (e) {
        console.error('[Submissions] addVideoReply side-effect error:', e);
      }
      return reply;
    }),

  // Admin: mark a question as answered (close thread)
  markQuestionAnswered: adminProcedure
    .input(z.object({ questionId: z.number() }))
    .mutation(async ({ input }) => {
      await db.markQuestionAnswered(input.questionId);
      return { success: true };
    }),

  // Admin: reopen a question
  markQuestionOpen: adminProcedure
    .input(z.object({ questionId: z.number() }))
    .mutation(async ({ input }) => {
      await db.markQuestionOpen(input.questionId);
      return { success: true };
    }),

  // Admin: review a video submission (written feedback + optional voice note)
  reviewVideo: adminProcedure
    .input(z.object({
      submissionId: z.number(),
      feedback: z.string().max(5000).optional(),
      voiceFeedbackKey: z.string().optional(),
      voiceFeedbackUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.reviewVideoSubmission({
        submissionId: input.submissionId,
        feedback: input.feedback ?? null,
        voiceFeedbackKey: input.voiceFeedbackKey ?? null,
        voiceFeedbackUrl: input.voiceFeedbackUrl ?? null,
        reviewedBy: ctx.user.id,
      });
      // Notify the trainee
      const v = await db.getVideoSubmissionById(input.submissionId);
      if (v) {
        await db.createNotification({
          userId: v.userId,
          type: 'video_reviewed',
          title: 'Video Feedback Ready',
          message: `${ctx.user.name ?? 'Leadership'} left feedback on your video: "${v.title}"`,
          relatedId: input.submissionId,
        });
        // Email the trainee
        const trainee = await db.getUserById(v.userId);
        if (trainee?.email) {
          sendVideoReviewedEmail(
            trainee.email,
            trainee.name ?? 'Trainee',
            v.title,
            input.feedback ?? null,
            ctx.user.name ?? 'Leadership'
          ).catch((e) => console.error('[Submissions] Video reviewed email failed:', e));
        }
      }
      return { success: true };
    }),
});
// ─── Library Router ─────────────────────────────────────────────────────────
const libraryRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      category: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getLibraryVideos({ search: input.search, category: input.category });
    }),

  categories: protectedProcedure.query(async () => {
    return db.getLibraryCategories();
  }),

  sync: adminProcedure.mutation(async () => {
    const { syncLibraryVideos } = await import('./scheduledLibrarySync');
    return syncLibraryVideos();
  }),
});

// ─── Text Highlights Router ───────────────────────────────────────────────────
const highlightsRouter = router({
  getAll: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ input, ctx }) => {
      return db.getTextHighlights(ctx.user.id, input.moduleId);
    }),
  save: protectedProcedure
    .input(z.object({
      moduleId: z.number(),
      startOffset: z.number(),
      endOffset: z.number(),
      color: z.string().max(20),
      selectedText: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.saveTextHighlight(
        ctx.user.id, input.moduleId, input.startOffset, input.endOffset, input.color, input.selectedText
      );
      return { id };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteTextHighlight(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  sops: sopsRouter,
  tracks: tracksRouter,
  progress: progressRouter,
  quiz: quizRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
  scheduled: scheduledRouter,
  storage: storageRouter,
  grading: gradingRouter,
  dailyFocus: dailyFocusRouter,
  softwareChecklist: softwareChecklistRouter,
  moduleTaskItems: moduleTaskItemsRouter,
  activityLog: activityLogRouter,
  submissions: submissionsRouter,
  library: libraryRouter,
  highlights: highlightsRouter,
});
export type AppRouter = typeof appRouter;

