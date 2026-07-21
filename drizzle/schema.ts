import {
  boolean,
  date,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  teamRole: mysqlEnum("teamRole", ["ca", "associate_doctor", "scan_tech", "preceptor"]),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  onboardingStartedAt: timestamp("onboardingStartedAt"),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: text("passwordHash"),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
  testOutDate: timestamp("testOutDate"),
  // Gamification: daily activity streak.
  streakCount: int("streakCount").default(0).notNull(),
  lastActiveDate: date("lastActiveDate", { mode: "string" }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Library Videos ───────────────────────────────────────────────────────────
export const libraryVideos = mysqlTable("library_videos", {
  id: int("id").autoincrement().primaryKey(),
  driveFileId: varchar("driveFileId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }).notNull().default("General"),
  description: text("description"),
  driveCreatedAt: timestamp("driveCreatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LibraryVideo = typeof libraryVideos.$inferSelect;

// ─── SOP Categories ───────────────────────────────────────────────────────────
export const sopCategories = mysqlTable("sop_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SopCategory = typeof sopCategories.$inferSelect;

// ─── SOPs ─────────────────────────────────────────────────────────────────────
export const sops = mysqlTable("sops", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: mediumtext("content").notNull(),
  googleDocId: varchar("googleDocId", { length: 255 }),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
  version: int("version").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  flaggedForReview: boolean("flaggedForReview").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sop = typeof sops.$inferSelect;

// ─── SOP Versions (archive) ───────────────────────────────────────────────────
export const sopVersions = mysqlTable("sop_versions", {
  id: int("id").autoincrement().primaryKey(),
  sopId: int("sopId").notNull(),
  version: int("version").notNull(),
  content: mediumtext("content").notNull(),
  archivedAt: timestamp("archivedAt").defaultNow().notNull(),
});

export type SopVersion = typeof sopVersions.$inferSelect;

// ─── Learning Tracks ──────────────────────────────────────────────────────────
export const tracks = mysqlTable("tracks", {
  id: int("id").autoincrement().primaryKey(),
  teamRole: mysqlEnum("teamRole", ["ca", "associate_doctor", "scan_tech", "preceptor"]).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Track = typeof tracks.$inferSelect;

// ─── Track Milestones ─────────────────────────────────────────────────────────
export const milestones = mysqlTable("milestones", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  weekNumber: int("weekNumber").notNull(),
  dueDay: int("dueDay"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Milestone = typeof milestones.$inferSelect;

// ─── Modules ──────────────────────────────────────────────────────────────────
export const modules = mysqlTable("modules", {
  id: int("id").autoincrement().primaryKey(),
  milestoneId: int("milestoneId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["sop", "video", "task", "checklist"]).notNull(),
  sopId: int("sopId"),
  loomUrl: varchar("loomUrl", { length: 1000 }),
  loomUrl2: varchar("loomUrl2", { length: 1000 }),
  loomVideoId: varchar("loomVideoId", { length: 255 }),
  taskInstructions: text("taskInstructions"),
  audioFiles: json("audioFiles").$type<{ label: string; url: string }[]>(),
  sortOrder: int("sortOrder").default(0),
  isRequired: boolean("isRequired").default(true).notNull(),
  quizEnabled: boolean("quizEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Module = typeof modules.$inferSelect;

// ─── Quizzes ──────────────────────────────────────────────────────────────────
export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("moduleId").notNull().unique(),
  questions: json("questions").notNull(),
  passingScore: int("passingScore").default(70).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;

// ─── User Module Progress ─────────────────────────────────────────────────────
export const userModuleProgress = mysqlTable("user_module_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed", "needs_review"]).default("not_started").notNull(),
  completedAt: timestamp("completedAt"),
  flaggedForReview: boolean("flaggedForReview").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserModuleProgress = typeof userModuleProgress.$inferSelect;

// ─── Quiz Attempts ────────────────────────────────────────────────────────────
export const quizAttempts = mysqlTable("quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  quizId: int("quizId").notNull(),
  moduleId: int("moduleId").notNull(),
  answers: json("answers").notNull(),
  score: int("score").notNull(),
  passed: boolean("passed").notNull(),
  attemptNumber: int("attemptNumber").default(1).notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["overdue_reminder", "quiz_failed", "onboarding_complete", "sop_updated", "approval_needed", "account_approved", "account_rejected", "question_submitted", "question_answered", "video_submitted", "video_reviewed"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  relatedId: int("relatedId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── SOP Review Flags ─────────────────────────────────────────────────────────
export const sopReviewFlags = mysqlTable("sop_review_flags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sopId: int("sopId").notNull(),
  reason: text("reason"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SopReviewFlag = typeof sopReviewFlags.$inferSelect;
// ─── New Hire Prep Checklist ──────────────────────────────────────────────────
export const newHirePrepChecklist = mysqlTable("new_hire_prep_checklist", {
  id: int("id").autoincrement().primaryKey(),
  /** The user (new hire) this checklist is for */
  newHireUserId: int("newHireUserId").notNull(),
  /** Admin who owns this checklist */
  adminUserId: int("adminUserId").notNull(),
  /** JSON array of { key: string, label: string, completed: boolean, completedAt: Date|null } */
  items: json("items").notNull(),
  /** Selected SOPs for binder (array of SOP IDs) */
  binderSopIds: json("binderSopIds").$type<number[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NewHirePrepChecklist = typeof newHirePrepChecklist.$inferSelect;

// ─── Test Out Grades ─────────────────────────────────────────────────────────
export const testOutGrades = mysqlTable("test_out_grades", {
  id: int("id").autoincrement().primaryKey(),
  /** The user (trainee) being graded */
  userId: int("userId").notNull(),
  /** The module being graded */
  moduleId: int("moduleId").notNull(),
  /** The milestone this grade was given in */
  milestoneId: int("milestoneId").notNull(),
  /** Grade result */
  grade: mysqlEnum("grade", ["mastered", "needs_improvement"]).notNull(),
  /** Admin who graded */
  gradedBy: int("gradedBy").notNull(),
  /** If needs_improvement, the next milestone it was carried forward to */
  carriedToMilestoneId: int("carriedToMilestoneId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TestOutGrade = typeof testOutGrades.$inferSelect;

// ─── Daily Check-In Checkoffs ────────────────────────────────────────────────────────────────────────────────
export const dailyCheckins = mysqlTable("daily_checkins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  /** ISO date string YYYY-MM-DD — resets each day */
  checkDate: varchar("checkDate", { length: 10 }).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export type DailyCheckin = typeof dailyCheckins.$inferSelect;

// ─── Software Access Checklist ────────────────────────────────────────────────
export const softwareChecklist = mysqlTable("software_checklist", {
  id: int("id").autoincrement().primaryKey(),
  /** The user (trainee) this checklist belongs to */
  userId: int("userId").notNull(),
  /** The module this checklist is attached to */
  moduleId: int("moduleId").notNull(),
  /** Software name e.g. 'ChiroHD' */
  softwareName: varchar("softwareName", { length: 255 }).notNull(),
  /** Whether access has been confirmed */
  isChecked: boolean("isChecked").default(false).notNull(),
  checkedAt: timestamp("checkedAt"),
  /** Who checked it off */
  checkedBy: int("checkedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SoftwareChecklist = typeof softwareChecklist.$inferSelect;

// ─── Module Task Items (bullet-point checkboxes) ────────────────────────────
export const moduleTaskItems = mysqlTable("module_task_items", {
  id: int("id").autoincrement().primaryKey(),
  /** The trainee this row belongs to */
  userId: int("userId").notNull(),
  /** The module this checklist is attached to */
  moduleId: int("moduleId").notNull(),
  /** The bullet text exactly as stored in the description */
  itemText: varchar("itemText", { length: 512 }).notNull(),
  /** Zero-based index of the bullet in the description */
  itemIndex: int("itemIndex").notNull(),
  isChecked: boolean("isChecked").default(false).notNull(),
  checkedAt: timestamp("checkedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModuleTaskItem = typeof moduleTaskItems.$inferSelect;

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  /** The user who performed the action */
  userId: int("userId").notNull(),
  /** Event type */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  /** Human-readable description */
  description: varchar("description", { length: 512 }).notNull(),
  /** Optional reference to a module */
  moduleId: int("moduleId"),
  /** Optional reference to a milestone */
  milestoneId: int("milestoneId"),
  /** Extra JSON payload (score, softwareName, etc.) */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;

// ─── Questions (Submission Portal) ───────────────────────────────────────────
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  /** Trainee who submitted the question */
  userId: int("userId").notNull(),
  /** Optional module context */
  moduleId: int("moduleId"),
  /** Module name (stored as text for display) */
  moduleName: varchar("moduleName", { length: 255 }),
  /** The question text */
  question: text("question").notNull(),
  /** Admin reply */
  reply: text("reply"),
  /** Who replied */
  repliedBy: int("repliedBy"),
  repliedAt: timestamp("repliedAt"),
  /** Status: open | answered */
  status: varchar("status", { length: 32 }).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Question = typeof questions.$inferSelect;

// ─── Video Submissions (Submission Portal) ────────────────────────────────────
export const videoSubmissions = mysqlTable("video_submissions", {
  id: int("id").autoincrement().primaryKey(),
  /** Trainee who submitted the video */
  userId: int("userId").notNull(),
  /** Module this video is for */
  moduleId: int("moduleId"),
  /** Title / description from the trainee */
  title: varchar("title", { length: 255 }).notNull(),
  /** S3 storage key for the uploaded video */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** Accessible URL */
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  /** Original filename */
  fileName: varchar("fileName", { length: 255 }).notNull(),
  /** Written feedback from admin */
  feedback: text("feedback"),
  /** S3 key for admin voice note */
  voiceFeedbackKey: varchar("voiceFeedbackKey", { length: 512 }),
  /** Accessible URL for voice note */
  voiceFeedbackUrl: varchar("voiceFeedbackUrl", { length: 512 }),
  /** Who left feedback */
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  /** Status: pending | reviewed */
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type VideoSubmission = typeof videoSubmissions.$inferSelect;

// ─── Module → SOP Links ───────────────────────────────────────────────────────
export const moduleSops = mysqlTable("module_sops", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("moduleId").notNull(),
  sopId: int("sopId").notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ModuleSop = typeof moduleSops.$inferSelect;

// ─── Question Replies (Threaded Conversations) ────────────────────────────────
export const questionReplies = mysqlTable("question_replies", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuestionReply = typeof questionReplies.$inferSelect;

// ─── Video Replies (Threaded Conversations) ───────────────────────────────────
export const videoReplies = mysqlTable("video_replies", {
  id: int("id").autoincrement().primaryKey(),
  videoSubmissionId: int("videoSubmissionId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type VideoReply = typeof videoReplies.$inferSelect;

// ─── Text Highlights (Script Memorization) ────────────────────────────────────
export const textHighlights = mysqlTable("text_highlights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  moduleId: int("moduleId").notNull(),
  startOffset: int("startOffset").notNull(),
  endOffset: int("endOffset").notNull(),
  color: varchar("color", { length: 20 }).notNull().default("yellow"),
  selectedText: text("selectedText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TextHighlight = typeof textHighlights.$inferSelect;
