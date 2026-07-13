# Reformation Training Hub — Build Tracker

## Phase 1: Database Schema & Backend
- [x] Extend drizzle/schema.ts with all tables (users, sops, tracks, milestones, modules, quizzes, progress, notifications, review flags)
- [x] Run migration and apply SQL
- [x] Add db.ts query helpers
- [x] Build all tRPC routers (auth, users, sops, tracks, progress, quiz, notifications, admin, scheduled)

## Phase 2: Core UI & Auth
- [x] Global design system (Inter font, warm cream + charcoal + gold palette, index.css)
- [x] AppLayout sidebar with navigation, user menu, notification badge
- [x] Login page with Google OAuth button
- [x] Pending approval page
- [x] Admin approval gate (users blocked until approved + role assigned)

## Phase 3: SOP Library
- [x] SOP Library page with category filter and search
- [x] SOP detail viewer with Last Updated + version history
- [x] SOP content seeded from Google Drive (37 SOPs, 7 categories)
- [x] "Needs Re-Review" flagging for updated SOPs

## Phase 4: Learning Tracks
- [x] CA track (Week 1/2/30/90 milestones)
- [x] Associate Doctor track
- [x] Scan Tech track
- [x] Preceptor track
- [x] My Training Track page with milestone breakdown and module cards
- [x] Progress tracker per user (not_started → in_progress → completed)

## Phase 5: Quizzes
- [x] Quiz display after SOP/video module (ModuleView page)
- [x] AI-generated questions (4 questions, 75% passing score)
- [x] Quiz results saved per user
- [x] Retry logic with best score tracking

## Phase 6: Loom Video Embedding
- [x] Loom embed component in ModuleView
- [x] CA track fully rebuilt from Monday.com export: 14 milestones (Week 1-12 + Stretch Goals + AMPED), 76 modules, all Loom URLs embedded
- [ ] Actual Loom video URLs for AMPED modules — pending user login to Loom account

## Phase 7: Admin Dashboard
- [x] Admin Dashboard with team stats, pending approvals, progress table
- [x] Admin Users page with approve/reject + role assignment modal

## Phase 8: Notifications
- [x] In-app notifications (account approved/rejected, quiz failed, onboarding complete)
- [x] Admin owner notifications on quiz fail and onboarding completion
- [ ] Email reminders for overdue items (future enhancement)

## Phase 9: Monthly SOP Sync
- [ ] Set up monthly scheduled task (requires deployed site first)

## Pending (Requires User Action)
- [x] Google Cloud Console OAuth setup — replaced by email/password auth (no OAuth needed)
- [ ] Loom video URLs — user to log in and provide video library
- [ ] Deploy / Publish site
- [ ] Custom domain setup (deferred)

## Tests
- [x] auth.logout.test.ts (1 test)
- [x] training.test.ts (12 tests)
- Total: 13 tests passing

## Phase 10: New Hire Prep Checklist (Admin)
- [x] New hire prep checklist card on Admin Dashboard (Phase 1 — One Month Before Start)
- [x] Checklist items: review training modules, order name tag, set up binder, welcome gift (T-shirt, notebook, pens, candle)
- [x] SOP print selection feature — admin can select SOPs by role and print/export for binder
- [x] Checklist state saved per pending/approved user so admin can track completion

## Phase 11: Audio Playback Fix
- [x] Converted WAV phone consult recordings to MP3 for universal browser support
- [x] Re-uploaded MP3 files to storage and updated database references
- [x] Audio players now show duration (Hayden C. 20:15, Noah J. 21:27, Augustus 36:50) and play correctly

## Phase 12: Progressive Web App (PWA)
- [x] Generate app icons (192x192, 512x512, maskable) with Reformation logo
- [x] Create web app manifest (manifest.json) with name, icons, theme color, display standalone
- [x] Register service worker for offline shell caching
- [x] Add PWA meta tags to index.html (theme-color, apple-touch-icon, viewport)
- [x] Test install prompt on mobile and desktop

## Phase 13: Mobile PWA Optimization
- [x] AppLayout: bottom tab bar on mobile, hamburger/drawer sidebar on mobile
- [x] Dashboard page: stacked layout on mobile, full-width cards
- [x] MyTrack page: full-width track cards, larger touch targets
- [x] ModuleView page: full-width content, mobile-friendly audio/video
- [x] SOP Library: full-width list, touch-friendly rows
- [x] Admin pages: responsive tables/forms
- [x] Global: no horizontal overflow, proper mobile padding/spacing

## Phase 14: Splash Screen
- [x] Branded splash screen with forest green background and Reformation logo
- [x] Fade-out animation when app is ready
- [x] Works on both mobile PWA and desktop

## Phase 15: PWA Install Prompt
- [x] Custom install banner using beforeinstallprompt (Android/Chrome/Edge)
- [x] iOS Safari manual instructions sheet (Share → Add to Home Screen)
- [x] Dismissed state persisted in localStorage (don't show again if dismissed)
- [x] Only show when not already installed (standalone mode check)

## Phase 16: Dashboard Milestone Navigation
- [x] Dashboard week/milestone rows are clickable (cursor-pointer, hover styles)
- [x] Clicking a row navigates to /my-track#milestone-{id}
- [x] MyTrack milestone sections have id="milestone-{id}" anchor attributes
- [x] MyTrack scrolls to the matching milestone section on mount (smooth scroll, 150ms delay)
## Phase 17: Software Access Checklist
- [x] software_checklist DB table (migration 0008 applied)
- [x] getSoftwareChecklist() and toggleSoftwareItem() helpers in db.ts
- [x] softwareChecklistRouter (getItems, toggleItem) in routers.ts, registered in appRouter
- [x] SoftwareChecklistCard in ModuleView.tsx for module IDs 172 and 286
- [x] Auto-completes module with confetti when all 9 items are checked
- [x] Stray comment at end of routers.ts removed

## Phase 18: Activity Log
- [x] activity_log DB table (migration 0009 applied)
- [x] logActivity() and getActivityLogs() helpers in db.ts
- [x] activityLogRouter (list) in routers.ts, registered in appRouter
- [x] logActivity calls wired into progress.update, quiz.submit, grading.setGrade, softwareChecklist.toggleItem
- [x] ActivityLog admin page at /admin/activity with trainee + event type filters and pagination
- [x] Activity nav item added to admin sidebar

## Phase 19: Email/Password Authentication
- [x] Install nodemailer + bcryptjs
- [x] Schema: passwordHash, resetToken, resetTokenExpiresAt added to users table (migration 0013)
- [x] Schema: openId made nullable (migration 0014)
- [x] emailAuth.ts: hashPassword, verifyPassword, sendPasswordResetEmail helpers
- [x] authRouter: login, logout, requestPasswordReset, resetPassword, changePassword procedures
- [x] usersRouter: createUser (admin), deleteUser (admin), adminResetPassword procedures
- [x] context.ts: handles email: prefix session tokens for email-only users
- [x] Login.tsx: email/password form with forgot password link
- [x] ResetPassword.tsx: token-based password reset page
- [x] AdminUsers.tsx: Create User dialog for admin
- [x] Admin accounts created: selena@reformationchiropractic.com, drrobert@reformationchiropractic.com
- [x] All OAuth redirects replaced with /login
- [x] Login flow verified end-to-end via API (both admin accounts)
- [x] Mobile: admin "More" sheet in bottom tab bar for admin-only nav items

## Phase 20: Track Editor
- [x] Backend procedures: adminTrack, updateTrack, addWeek, updateWeek, deleteWeek, addModule, updateModule, deleteModule, reorderModules, reorderWeeks
- [x] TrackEditor page with track selector, week accordion, drag-to-reorder, inline module editing
- [x] Module edit dialog: title, type, Loom URL, Loom URL 2, description, task instructions, required, quiz enabled, move to different week
- [x] Add/delete week and module with confirmation dialogs
- [x] Admin nav: "Tracks" link added to sidebar and mobile More sheet

## Phase 21: Trainee Preview Mode
- [x] Backend: reused adminTrack procedure (already returns full track with all weeks/modules)
- [x] TrackPreviewModal: full-screen overlay showing trainee view (week accordion, module cards, current/next/locked week labels, type/required/quiz badges)
- [x] "Preview as Trainee" button in TrackEditor header
- [x] Preview reflects live data (re-opens with fresh query on each click)

## Phase 22: Welcome Email on User Creation
- [x] Send welcome email automatically when admin creates a new user
- [x] Email contains: login link, their email address, temporary password, and practice name branding

## Phase 23: Task Checklist Checkboxes in ModuleView
- [x] module_task_items DB table created (migration 0015 applied)
- [x] getModuleTaskItems() and upsertModuleTaskItem() helpers in db.ts
- [x] moduleTaskItemsRouter (getItems, toggleItem) in routers.ts, registered in appRouter
- [x] ModuleView: bullet lines in description parsed and rendered as interactive Checkbox rows
- [x] Checkbox state persisted per user/module/item in DB
- [x] Warning shown when not all bullets checked; success message when all checked
- [x] Mark as Complete button disabled until all bullet checkboxes are checked

## Phase 24: Global Module Search on Dashboard
- [x] Backend: searchModules procedure — searches title + description across all modules in user's track
- [x] Dashboard: search bar UI with live results dropdown (module title, week label, type badge)
- [x] Clicking a result navigates to /modules/:id

## Phase 25: Related SOPs in ModuleView
- [x] module_sops join table created (migration 0016 applied)
- [x] 32 rows inserted: 8 "Watch Care Plan Guide" modules × 4 Care Plans SOPs
- [x] getModuleSops() helper in db.ts
- [x] tracks.getModuleSops tRPC procedure in routers.ts
- [x] ModuleView: "Related SOPs" card below module content with clickable links to /sops/:id
- [x] Bi-weekly heartbeat for /api/scheduled/sop-sync (task_uid: Khdy5SYhXaJcTKjVVq9ho5, runs 1st+15th of month at 3am UTC)

## Phase 26: Learning Library

- [x] DB table: library_videos (id, driveFileId, name, category, description, createdAt, updatedAt)
- [x] syncLibraryVideos() helper in db.ts + /api/scheduled/library-sync endpoint (uses rclone)
- [x] tRPC: library.list (search + category filter), library.sync (admin manual trigger)
- [x] UI: Learning Library page with search bar, category filter tabs, video grid
- [x] Sidebar nav entry "Learning Library"
- [x] Bi-weekly heartbeat for library-sync (task_uid: giRy6cmg3V9p8Vp2mfpnWt, runs 1st+15th of month at 3am UTC)
- [x] Manual sync completed: 6 videos loaded from Google Drive

## Phase 27: Threaded Question Replies + Deep Link Emails
- [ ] DB: question_replies table (id, questionId, userId, message, createdAt)
- [ ] Extend session to 30 days (remember me)
- [ ] tRPC: submissions.addReply, submissions.getReplies
- [ ] Email on each reply with deep link to /submissions?id=X or /admin/submissions?id=X
- [ ] UI: thread view in Submissions page (trainee)
- [ ] UI: thread view in AdminSubmissions page (admin)

## Phase 28: Test-Out Week Unlock Fix
- [ ] Fix unlock logic: a test-out week unlocks the NEXT week only when all items in that week are graded "Mastered" by admin
- [ ] Trainee view: locked future weeks stay hidden until admin passes them
- [ ] Admin view: can always see all weeks regardless of unlock status

## Phase 29: Script Highlighting
- [ ] Add text_highlights DB table (userId, moduleId, startOffset, endOffset, color, selectedText)
- [ ] Add getHighlights / saveHighlight / deleteHighlight tRPC procedures
- [ ] Build HighlightableScript component with color picker toolbar
- [ ] Wire into SCRIPT_MODULE_IDS in ModuleView
