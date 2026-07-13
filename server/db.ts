import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  Milestone,
  Module,
  Notification,
  Quiz,
  QuizAttempt,
  Sop,
  SopCategory,
  TestOutGrade,
  Track,
  UserModuleProgress,
  milestones,
  moduleTaskItems,
  modules,
  notifications,
  quizAttempts,
  quizzes,
  sopCategories,
  sopReviewFlags,
  sopVersions,
  sops,
  testOutGrades,
  tracks,
  userModuleProgress,
  users,
  activityLog,
  ActivityLog,
  questions,
  Question,
  videoSubmissions,
  VideoSubmission,
  moduleSops,
  ModuleSop,
  libraryVideos,
  LibraryVideo,
  questionReplies,
  QuestionReply,
  videoReplies,
  VideoReply,
  textHighlights,
  TextHighlight,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  // Owner is always auto-approved
  if (user.openId === ENV.ownerOpenId) {
    values.approvalStatus = "approved";
    updateSet.approvalStatus = "approved";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.approvalStatus, "pending")).orderBy(desc(users.createdAt));
}

export async function updateUserApproval(
  userId: number,
  status: "approved" | "rejected",
  approvedBy: number
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    approvalStatus: status,
    approvedAt: new Date(),
    approvedBy,
  }).where(eq(users.id, userId));
}

export async function updateUserTeamRole(userId: number, teamRole: "ca" | "associate_doctor" | "scan_tech" | "preceptor") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ teamRole, onboardingStartedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserTestOutDate(userId: number, testOutDate: Date | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ testOutDate }).where(eq(users.id, userId));
}

// ─── SOP Categories ───────────────────────────────────────────────────────────

export async function getSopCategories(): Promise<SopCategory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sopCategories).orderBy(sopCategories.sortOrder);
}

export async function upsertSopCategory(data: { name: string; slug: string; description?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(sopCategories).values(data).onDuplicateKeyUpdate({ set: { name: data.name, description: data.description ?? null } });
}

// ─── SOPs ─────────────────────────────────────────────────────────────────────

export async function getSopsByCategory(categoryId: number): Promise<Sop[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sops).where(and(eq(sops.categoryId, categoryId), eq(sops.isActive, true))).orderBy(sops.title);
}

export async function getAllSops(): Promise<Sop[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sops).where(eq(sops.isActive, true)).orderBy(sops.title);
}

export async function getSopById(id: number): Promise<Sop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sops).where(eq(sops.id, id)).limit(1);
  return result[0];
}

export async function getSopByGoogleDocId(googleDocId: string): Promise<Sop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sops).where(eq(sops.googleDocId, googleDocId)).limit(1);
  return result[0];
}

export async function upsertSop(data: {
  categoryId: number;
  title: string;
  content: string;
  googleDocId: string;
  lastUpdated: Date;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const existing = await getSopByGoogleDocId(data.googleDocId);
  if (existing) {
    // Archive old version if content changed
    if (existing.content !== data.content) {
      await db.insert(sopVersions).values({
        sopId: existing.id,
        version: existing.version,
        content: existing.content,
        archivedAt: new Date(),
      });
      await db.update(sops).set({
        content: data.content,
        lastUpdated: data.lastUpdated,
        version: existing.version + 1,
        flaggedForReview: true,
        updatedAt: new Date(),
      }).where(eq(sops.id, existing.id));
    }
    return existing.id;
  } else {
    const result = await db.insert(sops).values({
      categoryId: data.categoryId,
      title: data.title,
      content: data.content,
      googleDocId: data.googleDocId,
      lastUpdated: data.lastUpdated,
      version: 1,
      isActive: true,
      flaggedForReview: false,
    });
    return Number((result as any).insertId ?? 0);
  }
}

export async function getSopVersions(sopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sopVersions).where(eq(sopVersions.sopId, sopId)).orderBy(desc(sopVersions.version));
}

// ─── Tracks & Milestones ──────────────────────────────────────────────────────

export async function getTracks(): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tracks).orderBy(tracks.name);
}

export async function getTrackByRole(teamRole: string): Promise<Track | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tracks).where(eq(tracks.teamRole, teamRole as any)).limit(1);
  return result[0];
}

export async function getMilestoneById(id: number): Promise<Milestone | null> {
  const db = await getDb();
  if (!db) return null;
  const [ms] = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1);
  return ms ?? null;
}

export async function getMilestonesByTrack(trackId: number): Promise<Milestone[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(milestones).where(eq(milestones.trackId, trackId)).orderBy(milestones.sortOrder);
}

export async function getModulesByMilestone(milestoneId: number): Promise<Module[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modules).where(eq(modules.milestoneId, milestoneId)).orderBy(modules.sortOrder);
}

export async function getModuleById(id: number): Promise<Module | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  return result[0];
}

// ─── Quizzes ──────────────────────────────────────────────────────────────────

export async function getQuizByModuleId(moduleId: number): Promise<Quiz | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizzes).where(eq(quizzes.moduleId, moduleId)).limit(1);
  return result[0];
}

export async function upsertQuiz(moduleId: number, questions: unknown[], passingScore = 70) {
  const db = await getDb();
  if (!db) return;
  await db.insert(quizzes).values({ moduleId, questions, passingScore }).onDuplicateKeyUpdate({
    set: { questions, passingScore, updatedAt: new Date() },
  });
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function getUserProgress(userId: number): Promise<UserModuleProgress[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userModuleProgress).where(eq(userModuleProgress.userId, userId));
}

export async function getModuleProgress(userId: number, moduleId: number): Promise<UserModuleProgress | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userModuleProgress)
    .where(and(eq(userModuleProgress.userId, userId), eq(userModuleProgress.moduleId, moduleId)))
    .orderBy(desc(userModuleProgress.id))
    .limit(1);
  return result[0];
}

export async function upsertModuleProgress(
  userId: number,
  moduleId: number,
  status: "not_started" | "in_progress" | "completed" | "needs_review",
  completedAt?: Date
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userModuleProgress).values({
    userId,
    moduleId,
    status,
    completedAt: completedAt ?? null,
  }).onDuplicateKeyUpdate({
    set: { status, completedAt: completedAt ?? null, updatedAt: new Date() },
  });
}

// ─── Quiz Attempts ────────────────────────────────────────────────────────────

export async function saveQuizAttempt(data: {
  userId: number;
  quizId: number;
  moduleId: number;
  answers: number[];
  score: number;
  passed: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Count previous attempts
  const prev = await db.select({ count: sql<number>`count(*)` })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, data.userId), eq(quizAttempts.quizId, data.quizId)));
  const attemptNumber = (prev[0]?.count ?? 0) + 1;

  await db.insert(quizAttempts).values({ ...data, attemptNumber });
}

export async function getQuizAttempts(userId: number, moduleId: number): Promise<QuizAttempt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.moduleId, moduleId)))
    .orderBy(desc(quizAttempts.completedAt));
}

export async function getAllQuizAttempts(userId: number): Promise<QuizAttempt[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.completedAt));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(data: {
  userId: number;
  type: Notification["type"];
  title: string;
  message: string;
  relatedId?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getUserNotifications(userId: number): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ─── SOP Review Flags ─────────────────────────────────────────────────────────

export async function getUserSopReviewFlags(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sopReviewFlags)
    .where(and(eq(sopReviewFlags.userId, userId), sql`${sopReviewFlags.reviewedAt} IS NULL`));
}

export async function markSopReviewed(userId: number, sopId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(sopReviewFlags).set({ reviewedAt: new Date() })
    .where(and(eq(sopReviewFlags.userId, userId), eq(sopReviewFlags.sopId, sopId)));
}

export async function flagSopForAllUsers(sopId: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.approvalStatus, "approved"));
  for (const u of allUsers) {
    // Check if flag already exists
    const existing = await db.select().from(sopReviewFlags)
      .where(and(eq(sopReviewFlags.userId, u.id), eq(sopReviewFlags.sopId, sopId), sql`${sopReviewFlags.reviewedAt} IS NULL`))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(sopReviewFlags).values({ userId: u.id, sopId, reason });
    }
  }
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return null;

  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.approvalStatus, "approved"));
  const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.approvalStatus, "pending"));
  const [completedCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(sql`${users.onboardingCompletedAt} IS NOT NULL`);

  return {
    totalUsers: totalUsers?.count ?? 0,
    pendingApprovals: pendingCount?.count ?? 0,
    completedOnboarding: completedCount?.count ?? 0,
  };
}

// ─── New Hire Prep Checklist ──────────────────────────────────────────────────
import { newHirePrepChecklist } from "../drizzle/schema";

export type PrepChecklistItem = {
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  note?: string;
};

export const DEFAULT_PREP_CHECKLIST_ITEMS: PrepChecklistItem[] = [
  // Phase 1 — One Month Before Start
  { key: "review_modules", label: "Review all training modules for this role and confirm they are current", completed: false, completedAt: null },
  { key: "check_videos", label: "Verify all videos, scripts, and SOPs are up to date", completed: false, completedAt: null },
  { key: "order_name_tag", label: "Order name tag", completed: false, completedAt: null },
  { key: "build_binder", label: "Set up 1-inch binder with SOPs relevant to daily tasks and processes", completed: false, completedAt: null },
  { key: "gift_tshirt", label: "Welcome gift: Reformation T-Shirt", completed: false, completedAt: null },
  { key: "gift_notebook", label: "Welcome gift: Notebook", completed: false, completedAt: null },
  { key: "gift_pens", label: "Welcome gift: Pens", completed: false, completedAt: null },
  { key: "gift_candle", label: "Welcome gift: Candle", completed: false, completedAt: null },
];

export async function getPrepChecklist(newHireUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(newHirePrepChecklist)
    .where(eq(newHirePrepChecklist.newHireUserId, newHireUserId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertPrepChecklist(data: {
  newHireUserId: number;
  adminUserId: number;
  items: PrepChecklistItem[];
  binderSopIds: number[];
}) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getPrepChecklist(data.newHireUserId);
  if (existing) {
    await db.update(newHirePrepChecklist)
      .set({ items: data.items, binderSopIds: data.binderSopIds })
      .where(eq(newHirePrepChecklist.newHireUserId, data.newHireUserId));
  } else {
    await db.insert(newHirePrepChecklist).values({
      newHireUserId: data.newHireUserId,
      adminUserId: data.adminUserId,
      items: data.items,
      binderSopIds: data.binderSopIds,
    });
  }
  return getPrepChecklist(data.newHireUserId);
}

// ─── Test Out Grades ─────────────────────────────────────────────────────────

export async function setTestOutGrade({
  userId,
  moduleId,
  milestoneId,
  grade,
  gradedBy,
  carriedToMilestoneId,
}: {
  userId: number;
  moduleId: number;
  milestoneId: number;
  grade: "mastered" | "needs_improvement";
  gradedBy: number;
  carriedToMilestoneId?: number | null;
}): Promise<TestOutGrade | null> {
  const db = await getDb();
  if (!db) return null;
  // Upsert: update if exists for this user+module+milestone, else insert
  const existing = await db
    .select()
    .from(testOutGrades)
    .where(
      and(
        eq(testOutGrades.userId, userId),
        eq(testOutGrades.moduleId, moduleId),
        eq(testOutGrades.milestoneId, milestoneId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(testOutGrades)
      .set({ grade, gradedBy, carriedToMilestoneId: carriedToMilestoneId ?? null, updatedAt: new Date() })
      .where(eq(testOutGrades.id, existing[0].id));
    const [updated] = await db.select().from(testOutGrades).where(eq(testOutGrades.id, existing[0].id)).limit(1);
    return updated ?? null;
  } else {
    const [result] = await db
      .insert(testOutGrades)
      .values({ userId, moduleId, milestoneId, grade, gradedBy, carriedToMilestoneId: carriedToMilestoneId ?? null });
    const insertId = (result as any).insertId;
    const [inserted] = await db.select().from(testOutGrades).where(eq(testOutGrades.id, insertId)).limit(1);
    return inserted ?? null;
  }
}

export async function getTestOutGradesForUser(userId: number): Promise<TestOutGrade[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testOutGrades).where(eq(testOutGrades.userId, userId));
}

export async function getTestOutGradesForMilestone(userId: number, milestoneId: number): Promise<TestOutGrade[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(testOutGrades)
    .where(and(eq(testOutGrades.userId, userId), eq(testOutGrades.milestoneId, milestoneId)));
}

// ─── All SOPs with Category (for binder selection) ────────────────────────────
export async function getAllSopsWithCategory() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: sops.id,
    title: sops.title,
    categoryId: sops.categoryId,
    categoryName: sopCategories.name,
    isActive: sops.isActive,
  })
    .from(sops)
    .leftJoin(sopCategories, eq(sops.categoryId, sopCategories.id))
    .where(eq(sops.isActive, true))
    .orderBy(sopCategories.name, sops.title);
}

// ─── Daily Check-In Helpers ───────────────────────────────────────────────────
import { dailyCheckins, DailyCheckin } from "../drizzle/schema";

export async function getDailyCheckins(userId: number, checkDate: string): Promise<DailyCheckin[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyCheckins).where(
    and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkDate, checkDate))
  );
}

export async function toggleDailyCheckin(userId: number, moduleId: number, checkDate: string): Promise<{ checked: boolean }> {
  const db = await getDb();
  if (!db) return { checked: false };
  const existing = await db.select().from(dailyCheckins).where(
    and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.moduleId, moduleId), eq(dailyCheckins.checkDate, checkDate))
  );
  if (existing.length > 0) {
    await db.delete(dailyCheckins).where(
      and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.moduleId, moduleId), eq(dailyCheckins.checkDate, checkDate))
    );
    return { checked: false };
  } else {
    await db.insert(dailyCheckins).values({ userId, moduleId, checkDate });
    return { checked: true };
  }
}

// ─── Software Access Checklist Helpers ───────────────────────────────────────
import { softwareChecklist, SoftwareChecklist } from "../drizzle/schema";

const SOFTWARE_LIST_DEFAULT = [
  "Reformation Training Hub",
  "ChiroHD",
  "Gusto",
  "Monday.com",
  "Gmail",
  "Cash Practice",
  "Slack",
  "LastPass",
  "IntakeQ",
  "Skool",
];

const CHIRHOD_ACADEMY_LIST = [
  "Welcome!",
  "Users, Providers, and Calendars: (scheduling, print button & notifications, events, completing an appointment)",
  "User preferences, ChiroHD subscription: (preferences only)",
];

const MODULE_CHECKLIST_MAP: Record<number, string[]> = {
  172: SOFTWARE_LIST_DEFAULT,
  286: SOFTWARE_LIST_DEFAULT,
  120006: SOFTWARE_LIST_DEFAULT,
  179: CHIRHOD_ACADEMY_LIST,
  293: CHIRHOD_ACADEMY_LIST,
  120009: CHIRHOD_ACADEMY_LIST,
};

function getListForModule(moduleId: number): string[] {
  return MODULE_CHECKLIST_MAP[moduleId] ?? SOFTWARE_LIST_DEFAULT;
}

export async function getSoftwareChecklist(userId: number, moduleId: number): Promise<SoftwareChecklist[]> {
  const db = await getDb();
  if (!db) return [];
  const list = getListForModule(moduleId);
  const existing = await db.select().from(softwareChecklist).where(
    and(eq(softwareChecklist.userId, userId), eq(softwareChecklist.moduleId, moduleId))
  );
  const existingNames = existing.map((r) => r.softwareName);
  const missing = list.filter((s) => !existingNames.includes(s));
  if (missing.length > 0) {
    await db.insert(softwareChecklist).values(
      missing.map((softwareName) => ({ userId, moduleId, softwareName }))
    );
    return db.select().from(softwareChecklist).where(
      and(eq(softwareChecklist.userId, userId), eq(softwareChecklist.moduleId, moduleId))
    );
  }
  return existing;
}

export async function toggleSoftwareItem(
  userId: number,
  moduleId: number,
  softwareName: string,
  checkedBy: number
): Promise<{ isChecked: boolean; allChecked: boolean }> {
  const db = await getDb();
  if (!db) return { isChecked: false, allChecked: false };
  const [row] = await db.select().from(softwareChecklist).where(
    and(
      eq(softwareChecklist.userId, userId),
      eq(softwareChecklist.moduleId, moduleId),
      eq(softwareChecklist.softwareName, softwareName)
    )
  );
  if (!row) return { isChecked: false, allChecked: false };
  const newChecked = !row.isChecked;
  await db.update(softwareChecklist)
    .set({
      isChecked: newChecked,
      checkedAt: newChecked ? new Date() : null,
      checkedBy: newChecked ? checkedBy : null,
    })
    .where(eq(softwareChecklist.id, row.id));
  const all = await db.select().from(softwareChecklist).where(
    and(eq(softwareChecklist.userId, userId), eq(softwareChecklist.moduleId, moduleId))
  );
  const list = getListForModule(moduleId);
  const allChecked = all.length === list.length && all.every((r) => r.isChecked);
  return { isChecked: newChecked, allChecked };
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(params: {
  userId: number;
  eventType: string;
  description: string;
  moduleId?: number;
  milestoneId?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({
    userId: params.userId,
    eventType: params.eventType,
    description: params.description,
    moduleId: params.moduleId ?? null,
    milestoneId: params.milestoneId ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}

export async function getActivityLogs(opts: {
  userId?: number;
  limit?: number;
  offset?: number;
}): Promise<(ActivityLog & { userName: string; userEmail: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const rows = await db
    .select({
      id: activityLog.id,
      userId: activityLog.userId,
      eventType: activityLog.eventType,
      description: activityLog.description,
      moduleId: activityLog.moduleId,
      milestoneId: activityLog.milestoneId,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(opts.userId ? eq(activityLog.userId, opts.userId) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as any;
}

// ─── Questions (Submission Portal) ───────────────────────────────────────────

export async function submitQuestion(params: {
  userId: number;
  moduleId?: number | null;
  moduleName?: string | null;
  question: string;
}): Promise<Question | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(questions).values({
    userId: params.userId,
    moduleId: params.moduleId ?? null,
    moduleName: params.moduleName ?? null,
    question: params.question,
    status: "open",
  });
  const insertId = (result as any).insertId;
  const [row] = await db.select().from(questions).where(eq(questions.id, insertId)).limit(1);
  return row ?? null;
}

export async function getQuestionsForUser(userId: number): Promise<(Question & { moduleName: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: questions.id,
      userId: questions.userId,
      moduleId: questions.moduleId,
      moduleName: sql<string | null>`COALESCE(${questions.moduleName}, ${modules.title})`,
      question: questions.question,
      reply: questions.reply,
      repliedBy: questions.repliedBy,
      repliedAt: questions.repliedAt,
      status: questions.status,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .leftJoin(modules, eq(questions.moduleId, modules.id))
    .where(eq(questions.userId, userId))
    .orderBy(desc(questions.createdAt));
  return rows as any;
}

export async function getAllQuestions(opts: { limit?: number; offset?: number } = {}): Promise<(Question & { userName: string | null; userEmail: string | null; moduleName: string | null; resolvedModuleId: number | null })[]> {
  const db = await getDb();
  if (!db) return [];
  // Use a subquery for name-based module lookup to avoid duplicate rows when
  // multiple modules share the same title (e.g. "Watch \"Objections\"").
  const moduleById = alias(modules, 'moduleById');
  const rows = await db
    .select({
      id: questions.id,
      userId: questions.userId,
      moduleId: questions.moduleId,
      question: questions.question,
      reply: questions.reply,
      repliedBy: questions.repliedBy,
      repliedAt: questions.repliedAt,
      status: questions.status,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
      userName: users.name,
      userEmail: users.email,
      moduleName: sql<string | null>`COALESCE(${questions.moduleName}, ${moduleById.title})`,
      // Subquery picks the first matching module ID by name — prevents fan-out
      resolvedModuleId: sql<number | null>`COALESCE(
        ${questions.moduleId},
        (SELECT id FROM modules WHERE title = ${questions.moduleName} LIMIT 1)
      )`,
    })
    .from(questions)
    .leftJoin(users, eq(questions.userId, users.id))
    .leftJoin(moduleById, eq(questions.moduleId, moduleById.id))
    .orderBy(desc(questions.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
  return rows as any;
}

export async function replyToQuestion(params: {
  questionId: number;
  reply: string;
  repliedBy: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(questions).set({
    reply: params.reply,
    repliedBy: params.repliedBy,
    repliedAt: new Date(),
    status: "answered",
    updatedAt: new Date(),
  }).where(eq(questions.id, params.questionId));
}

export async function markQuestionAnswered(questionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(questions).set({
    status: "answered",
    updatedAt: new Date(),
  }).where(eq(questions.id, questionId));
}

export async function markQuestionOpen(questionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(questions).set({
    status: "open",
    updatedAt: new Date(),
  }).where(eq(questions.id, questionId));
}

export async function getQuestionById(id: number): Promise<(Question & { userName: string | null; userEmail: string | null }) | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      id: questions.id,
      userId: questions.userId,
      moduleId: questions.moduleId,
      question: questions.question,
      reply: questions.reply,
      repliedBy: questions.repliedBy,
      repliedAt: questions.repliedAt,
      status: questions.status,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(questions)
    .leftJoin(users, eq(questions.userId, users.id))
    .where(eq(questions.id, id))
    .limit(1);
  return (row as any) ?? null;
}

// ─── Video Submissions (Submission Portal) ────────────────────────────────────

export async function createVideoSubmission(params: {
  userId: number;
  moduleId?: number | null;
  moduleName?: string | null;
  title: string;
  fileKey: string;
  fileUrl: string;
  fileName: string;
}): Promise<VideoSubmission | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(videoSubmissions).values({
    userId: params.userId,
    moduleId: params.moduleId ?? null,
    title: params.title,
    fileKey: params.fileKey,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    status: "pending",
  });
  const insertId = (result as any).insertId;
  const [row] = await db.select().from(videoSubmissions).where(eq(videoSubmissions.id, insertId)).limit(1);
  return row ?? null;
}

export async function getVideoSubmissionsForUser(userId: number): Promise<VideoSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoSubmissions).where(eq(videoSubmissions.userId, userId)).orderBy(desc(videoSubmissions.createdAt));
}

export async function getAllVideoSubmissions(opts: { limit?: number; offset?: number } = {}): Promise<(VideoSubmission & { userName: string | null; userEmail: string | null; moduleName: string | null; resolvedModuleId: number | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const moduleById = alias(modules, 'vsModuleById');
  const rows = await db
    .select({
      id: videoSubmissions.id,
      userId: videoSubmissions.userId,
      moduleId: videoSubmissions.moduleId,
      title: videoSubmissions.title,
      fileKey: videoSubmissions.fileKey,
      fileUrl: videoSubmissions.fileUrl,
      fileName: videoSubmissions.fileName,
      feedback: videoSubmissions.feedback,
      reviewedBy: videoSubmissions.reviewedBy,
      reviewedAt: videoSubmissions.reviewedAt,
      status: videoSubmissions.status,
      createdAt: videoSubmissions.createdAt,
      updatedAt: videoSubmissions.updatedAt,
      userName: users.name,
      userEmail: users.email,
      moduleName: sql<string | null>`COALESCE(${moduleById.title}, ${videoSubmissions.title})`,
      // Subquery picks the first matching module ID by title — prevents fan-out
      resolvedModuleId: sql<number | null>`COALESCE(
        ${videoSubmissions.moduleId},
        (SELECT id FROM modules WHERE title = ${videoSubmissions.title} LIMIT 1)
      )`,
    })
    .from(videoSubmissions)
    .leftJoin(users, eq(videoSubmissions.userId, users.id))
    .leftJoin(moduleById, eq(videoSubmissions.moduleId, moduleById.id))
    .orderBy(desc(videoSubmissions.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
  return rows as any;
}

export async function reviewVideoSubmission(params: {
  submissionId: number;
  feedback?: string | null;
  voiceFeedbackKey?: string | null;
  voiceFeedbackUrl?: string | null;
  reviewedBy: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(videoSubmissions).set({
    feedback: params.feedback ?? null,
    voiceFeedbackKey: params.voiceFeedbackKey ?? null,
    voiceFeedbackUrl: params.voiceFeedbackUrl ?? null,
    reviewedBy: params.reviewedBy,
    reviewedAt: new Date(),
    status: "reviewed",
    updatedAt: new Date(),
  }).where(eq(videoSubmissions.id, params.submissionId));
}

export async function getVideoSubmissionById(id: number): Promise<(VideoSubmission & { userName: string | null; userEmail: string | null }) | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      id: videoSubmissions.id,
      userId: videoSubmissions.userId,
      moduleId: videoSubmissions.moduleId,
      title: videoSubmissions.title,
      fileKey: videoSubmissions.fileKey,
      fileUrl: videoSubmissions.fileUrl,
      fileName: videoSubmissions.fileName,
      feedback: videoSubmissions.feedback,
      reviewedBy: videoSubmissions.reviewedBy,
      reviewedAt: videoSubmissions.reviewedAt,
      status: videoSubmissions.status,
      createdAt: videoSubmissions.createdAt,
      updatedAt: videoSubmissions.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(videoSubmissions)
    .leftJoin(users, eq(videoSubmissions.userId, users.id))
    .where(eq(videoSubmissions.id, id))
    .limit(1);
  return (row as any) ?? null;
}

// ─── Admin Users Helper ───────────────────────────────────────────────────────
export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "admin"));
}

// ─── Email/Password Auth Helpers ──────────────────────────────────────────────
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function setResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function clearResetToken(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function createUserWithPassword(data: {
  email: string;
  name: string;
  passwordHash: string;
  teamRole?: "ca" | "associate_doctor" | "scan_tech" | "preceptor" | null;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `email_${data.email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    teamRole: data.teamRole ?? null,
    role: data.role ?? "user",
    approvalStatus: "approved",
    approvedAt: new Date(),
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return getUserByEmail(data.email);
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Module Task Items (bullet checkboxes) ────────────────────────────────────────────────

export async function getModuleTaskItems(userId: number, moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(moduleTaskItems)
    .where(and(eq(moduleTaskItems.userId, userId), eq(moduleTaskItems.moduleId, moduleId)))
    .orderBy(moduleTaskItems.itemIndex);
}

export async function upsertModuleTaskItem(
  userId: number,
  moduleId: number,
  itemIndex: number,
  itemText: string,
  isChecked: boolean
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(moduleTaskItems)
    .where(and(eq(moduleTaskItems.userId, userId), eq(moduleTaskItems.moduleId, moduleId), eq(moduleTaskItems.itemIndex, itemIndex)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(moduleTaskItems)
      .set({ isChecked, checkedAt: isChecked ? new Date() : null, updatedAt: new Date() })
      .where(eq(moduleTaskItems.id, existing[0].id));
  } else {
    await db.insert(moduleTaskItems).values({
      userId, moduleId, itemIndex, itemText, isChecked,
      checkedAt: isChecked ? new Date() : null,
    });
  }
}

// ─── Module SOP Links ─────────────────────────────────────────────────────────
export async function getModuleSops(moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: sops.id,
      title: sops.title,
      content: sops.content,
      sortOrder: moduleSops.sortOrder,
    })
    .from(moduleSops)
    .innerJoin(sops, eq(moduleSops.sopId, sops.id))
    .where(eq(moduleSops.moduleId, moduleId))
    .orderBy(moduleSops.sortOrder);
}

// ─── Library Videos ───────────────────────────────────────────────────────────

export async function getLibraryVideos(opts: { search?: string; category?: string } = {}): Promise<LibraryVideo[]> {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(libraryVideos).$dynamic();
  const conditions = [];
  if (opts.search) {
    conditions.push(like(libraryVideos.name, `%${opts.search}%`));
  }
  if (opts.category && opts.category !== 'All') {
    conditions.push(eq(libraryVideos.category, opts.category));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(desc(libraryVideos.driveCreatedAt));
}

export async function getLibraryCategories(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ category: libraryVideos.category }).from(libraryVideos).orderBy(libraryVideos.category);
  return rows.map(r => r.category);
}

export async function upsertLibraryVideo(video: {
  driveFileId: string;
  name: string;
  category: string;
  description?: string | null;
  driveCreatedAt?: Date | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(libraryVideos).values({
    driveFileId: video.driveFileId,
    name: video.name,
    category: video.category,
    description: video.description ?? null,
    driveCreatedAt: video.driveCreatedAt ?? null,
  }).onDuplicateKeyUpdate({
    set: {
      name: video.name,
      category: video.category,
      description: video.description ?? null,
      driveCreatedAt: video.driveCreatedAt ?? null,
    },
  });
}

// ─── Question Replies (Threads) ───────────────────────────────────────────────

export async function addQuestionReply(params: {
  questionId: number;
  userId: number;
  message: string;
}): Promise<QuestionReply | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(questionReplies).values({
    questionId: params.questionId,
    userId: params.userId,
    message: params.message,
  });
  // Fetch the most recently inserted reply (avoids insertId BigInt issues across MySQL drivers)
  const [row] = await db.select().from(questionReplies)
    .where(eq(questionReplies.questionId, params.questionId))
    .orderBy(sql`${questionReplies.id} DESC`)
    .limit(1);
  return row ?? null;
}

export async function getQuestionReplies(questionId: number): Promise<(QuestionReply & { userName: string | null; userRole: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: questionReplies.id,
      questionId: questionReplies.questionId,
      userId: questionReplies.userId,
      message: questionReplies.message,
      createdAt: questionReplies.createdAt,
      userName: users.name,
      userRole: users.role,
    })
    .from(questionReplies)
    .leftJoin(users, eq(questionReplies.userId, users.id))
    .where(eq(questionReplies.questionId, questionId))
    .orderBy(questionReplies.createdAt);
  return rows as any;
}

// ─── Video Replies (Threads) ──────────────────────────────────────────────────

export async function addVideoReply(params: {
  videoSubmissionId: number;
  userId: number;
  message: string;
}): Promise<VideoReply | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(videoReplies).values({
    videoSubmissionId: params.videoSubmissionId,
    userId: params.userId,
    message: params.message,
  });
  // Fetch the most recently inserted reply (avoids insertId BigInt issues across MySQL drivers)
  const [row] = await db.select().from(videoReplies)
    .where(eq(videoReplies.videoSubmissionId, params.videoSubmissionId))
    .orderBy(sql`${videoReplies.id} DESC`)
    .limit(1);
  return row ?? null;
}

export async function getVideoReplies(videoSubmissionId: number): Promise<(VideoReply & { userName: string | null; userRole: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: videoReplies.id,
      videoSubmissionId: videoReplies.videoSubmissionId,
      userId: videoReplies.userId,
      message: videoReplies.message,
      createdAt: videoReplies.createdAt,
      userName: users.name,
      userRole: users.role,
    })
    .from(videoReplies)
    .leftJoin(users, eq(videoReplies.userId, users.id))
    .where(eq(videoReplies.videoSubmissionId, videoSubmissionId))
    .orderBy(videoReplies.createdAt);
  return rows as any;
}

// ─── Text Highlights ──────────────────────────────────────────────────────────

export async function getTextHighlights(userId: number, moduleId: number): Promise<TextHighlight[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(textHighlights).where(
    and(eq(textHighlights.userId, userId), eq(textHighlights.moduleId, moduleId))
  ).orderBy(textHighlights.startOffset);
}

export async function saveTextHighlight(
  userId: number,
  moduleId: number,
  startOffset: number,
  endOffset: number,
  color: string,
  selectedText: string
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(textHighlights).values({
    userId, moduleId, startOffset, endOffset, color, selectedText,
  });
  return Number((result as any).insertId ?? 0);
}

export async function deleteTextHighlight(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(textHighlights).where(
    and(eq(textHighlights.id, id), eq(textHighlights.userId, userId))
  );
}
