import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  FlaskConical,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";

// ─── Report data ──────────────────────────────────────────────────────────────
// This page is a read-only rendering of the pre-sale acceptance-test pack.
// Content is data-driven so it's easy to keep in sync as the app evolves.

type Check = { id: string; step: string; expected: string; watch?: boolean; loc: string };
type Journey = { id: string; title: string; subtitle: string; checks: Check[] };
type Severity = "crit" | "high" | "med" | "low";
type Finding = { title: string; severity: Severity; problem: string; fix?: string; where: string };

const PERSONAS = [
  {
    initials: "MA",
    name: "Dr. Maya Adeyemi",
    role: "New Associate Doctor",
    start: "Just hired. No account yet. Comfortable with tech, short on time.",
    goal: "Get through the associate-doctor track: adjusting protocols, care-plan SOPs, scripts, weekly test-outs.",
    done: "All modules complete, test-outs graded mastered, onboarding marked complete.",
  },
  {
    initials: "JR",
    name: "Jordan Rivera",
    role: "New Chiropractic Assistant (CA)",
    start: "First clinic job. Phone-first. Never used a training app before.",
    goal: "Learn front-desk + scan-room SOPs, software access, daily-focus habits, submit practice videos.",
    done: "Software checklist signed off, videos reviewed, quizzes passed, comfortable day-to-day.",
  },
];

const JOURNEYS: Journey[] = [
  {
    id: "a",
    title: "A · Access & first login",
    subtitle: "The riskiest stretch — where a new hire gets in cleanly or gets stuck.",
    checks: [
      { id: "A1", step: "Admin creates Jordan's account in Admin → Team, setting a temp password and a team role of CA.", expected: "Account is created already approved — no separate approval step.", loc: "db.ts:1086" },
      { id: "A2", step: "Admin creates Maya's account but forgets to set a team role.", expected: "After login Maya sees an 'Almost there — an admin will assign your role' dead-end with only Sign out.", watch: true, loc: "AppLayout.tsx:74" },
      { id: "A3", step: "Jordan opens the site link on a phone and logs in with the temp password.", expected: "Lands on Dashboard. Install-to-home-screen prompt appears after ~3s.", loc: "InstallPrompt.tsx" },
      { id: "A4", step: "Try logging in with a wrong password.", expected: "'Invalid email or password' — no hint which field was wrong.", loc: "routers.ts:46" },
      { id: "A5", step: "Use 'Forgot password' → request reset for Jordan's email.", expected: "Always shows success (no account-exists leak); email sent only if the address exists & email is configured.", loc: "routers.ts:69" },
      { id: "A6", step: "Open the reset link, set a new 8+ char password, log in.", expected: "New password works; old one rejected; reset link now dead.", loc: "routers.ts:82" },
      { id: "A7", step: "Change password in-app with the wrong current password.", expected: "'Current password is incorrect' — blocked.", loc: "routers.ts:99" },
    ],
  },
  {
    id: "b",
    title: "B · Track, modules & daily focus",
    subtitle: "The core loop: work through weekly milestones and their modules.",
    checks: [
      { id: "B1", step: "Maya opens My Track.", expected: "Sees her associate-doctor track: weeks (milestones) with modules under each.", loc: "routers.ts:394" },
      { id: "B2", step: "Assign a role that has no track built yet, then open My Track.", expected: "Confirm the empty state is friendly, not a blank screen.", watch: true, loc: "routers.ts:394" },
      { id: "B3", step: "Open an SOP-type module, read it, mark complete.", expected: "Module flips to Completed; logged as module_completed.", loc: "routers.ts:734" },
      { id: "B4", step: "Open a video-type module and mark complete without watching.", expected: "Completes anyway — no watch verification (honor system).", watch: true, loc: "routers.ts:725" },
      { id: "B5", step: "Open a task/checklist module and tick its bullet items.", expected: "Each item persists as checked per-user.", loc: "routers.ts:1122" },
      { id: "B6", step: "On a module with a software checklist (e.g. ChiroHD), have admin confirm access.", expected: "Item shows checked, with who/when.", loc: "routers.ts:1143" },
      { id: "B7", step: "Use Daily Focus: check off a module for today, reload.", expected: "Check persists for today; resets tomorrow (per-day).", loc: "routers.ts:1105" },
      { id: "B8", step: "In an SOP, highlight a passage (script memorization).", expected: "Highlight saved and restored on return.", loc: "routers.ts:1574" },
      { id: "B9", step: "Complete every module in the track.", expected: "Onboarding auto-marks complete; owner + trainee notified.", loc: "routers.ts:754" },
    ],
  },
  {
    id: "c",
    title: "C · Quizzes",
    subtitle: "Only modules with quizzes enabled; passing gates completion.",
    checks: [
      { id: "C1", step: "Open a quiz-enabled module; start the quiz.", expected: "4 multiple-choice questions load (generated once, then cached).", loc: "routers.ts:781" },
      { id: "C2", step: "Answer to pass (≥ the passing score).", expected: "Module auto-completes; logged as quiz_passed.", loc: "routers.ts:906" },
      { id: "C3", step: "On another quiz module, answer to fail.", expected: "Module set back to In Progress; trainee gets 'try again'; owner notified.", loc: "routers.ts:917" },
      { id: "C4", step: "Retake the failed quiz and pass.", expected: "New attempt recorded (attempt #2); module completes.", loc: "routers.ts:896" },
      { id: "C5", step: "Check the pass threshold shown vs. enforced.", expected: "Generated quizzes save threshold 75, schema default is 70 — confirm which shows.", watch: true, loc: "routers.ts:864 / schema.ts:145" },
    ],
  },
  {
    id: "d",
    title: "D · Submissions (questions & videos)",
    subtitle: "Two-way contact between trainee and reviewer.",
    checks: [
      { id: "D1", step: "Jordan submits a question from a module.", expected: "Appears in admin Inbox; owner notified; status Open.", loc: "routers.ts:1173" },
      { id: "D2", step: "Admin replies; Jordan replies back (threaded).", expected: "Threaded messages both ways; trainee notified of answer.", loc: "routers.ts:1333" },
      { id: "D3", step: "Jordan records & uploads a technique video from a phone.", expected: "Uploads via server endpoint (avoids mobile CORS); shows Pending.", loc: "index.ts:101" },
      { id: "D4", step: "Upload a very large / non-video file.", expected: "Confirm the 500 MB limit and a clear error on oversize/wrong type.", watch: true, loc: "index.ts:100" },
      { id: "D5", step: "Admin reviews the video, leaves written + voice feedback.", expected: "Status → Reviewed; trainee notified; feedback visible.", loc: "routers.ts:1502" },
      { id: "D6", step: "If storage keys are not configured, attempt a video upload.", expected: "Confirm a graceful message, not a crash, when S3 is unset.", watch: true, loc: "index.ts:107" },
    ],
  },
  {
    id: "e",
    title: "E · Test-outs & finishing",
    subtitle: "Where 'did the modules' and 'proved mastery' meet — or don't.",
    checks: [
      { id: "E1", step: "Admin opens Test-Outs and grades Maya mastered on a week's module.", expected: "Grade saved; logged as test_out_graded.", loc: "routers.ts:1038" },
      { id: "E2", step: "Grade another module needs improvement.", expected: "Carried forward to the next test-out milestone… if its title contains a keyword.", loc: "routers.ts:1054" },
      { id: "E3", step: "Rename that next milestone so it has no keyword, then re-grade needs-improvement.", expected: "Carry-forward silently does nothing (no next milestone found).", watch: true, loc: "routers.ts:1061" },
      { id: "E4", step: "Finish all modules while a test-out is still needs improvement.", expected: "Onboarding still marks 'complete' — module completion ignores grades.", watch: true, loc: "routers.ts:754" },
    ],
  },
  {
    id: "f",
    title: "F · Admin oversight",
    subtitle: "Can the owner actually see who's on track?",
    checks: [
      { id: "F1", step: "Open the admin dashboard progress summary.", expected: "Per-trainee % complete, current week, on-track/behind status.", loc: "routers.ts:153" },
      { id: "F2", step: "Open a trainee's detail view.", expected: "Module-by-module progress + test-out grades visible.", loc: "routers.ts:216" },
      { id: "F3", step: "Build a New-Hire Prep checklist and pick SOPs for the binder.", expected: "Checklist + selected SOPs persist per new hire.", loc: "routers.ts:973" },
      { id: "F4", step: "Open the Activity Log.", expected: "Chronological events (started/completed/quiz/test-out).", loc: "routers.ts:1159" },
      { id: "F5", step: "Edit a track: add a week, add a module, reorder.", expected: "Changes persist and reflect on the trainee side.", loc: "routers.ts:558" },
      { id: "F6", step: "As a non-admin trainee, try to open /admin.", expected: "Blocked — admin routes require the admin role.", loc: "trpc.ts:30" },
    ],
  },
];

const FINDINGS: Finding[] = [
  { title: "New hire can be stranded with no role", severity: "crit",
    problem: "Account creation and team-role assignment are two separate actions. If an admin creates a user without a role, the trainee logs in to a dead-end screen whose only action is Sign out. No self-service, no admin nudge.",
    fix: "Make team role required in the create-user form, or surface pending-role users on the admin dashboard so they're never forgotten.",
    where: "AppLayout.tsx:74 · usersRouter.createUser routers.ts:259" },
  { title: "A whole approval workflow exists but is unreachable", severity: "high",
    problem: "There's a /pending page, users.approve/pending procedures, and account_approved/rejected notifications — but admin-created users are forced to approved and there is no public signup route. The approval surface is effectively dead code.",
    fix: "Decide the intent — add a real self-signup that lands people in 'pending', or remove the approval UI/logic to simplify.",
    where: "db.ts:1086 · App.tsx:57–77 (no /register) · routers.ts:114–139" },
  { title: "'Onboarding complete' ignores test-out mastery", severity: "high",
    problem: "Onboarding is marked complete purely when every module reaches completed. Test-out grades are a parallel system that doesn't feed the decision — so a trainee can be 'done' with unresolved needs-improvement test-outs.",
    fix: "Define one source of truth for 'ready' — e.g. require all test-outs mastered in addition to modules complete before firing completion.",
    where: "progress.update routers.ts:741–772 · grading.setGrade routers.ts:1038" },
  { title: "Test-out carry-forward depends on milestone titles", severity: "high",
    problem: "When a test-out is 'needs improvement', the next test-out is found by matching the milestone title against hardcoded keywords. Any office that names weeks differently silently loses carry-forward — the grade saves but nothing is scheduled for retry.",
    fix: "Add an explicit isTestOut boolean to milestones and select on that. Also removes a per-office rollout landmine.",
    where: "gradingRouter.setGrade routers.ts:1054–1061" },
  { title: "Module completion is honor-system for non-quiz modules", severity: "med",
    problem: "For SOP / video / task modules, 'complete' is whatever the client sends — no server-side check that a video was watched or an SOP opened. Fine for a trust-based culture; a risk if completion drives compliance claims when selling to teams.",
    fix: "Decide if that's acceptable and say so in sales material, or add lightweight signals (video ended, min dwell time) for modules that need rigor.",
    where: "progress.update routers.ts:725–732" },
  { title: "Passing score: two numbers, no admin control", severity: "med",
    problem: "Generated quizzes are saved with a passing score of 75, while the schema default is 70; scoring uses whatever is stored. There's also no admin UI to set or change a module's passing score.",
    fix: "Pick one default, and surface passing score in the Track Editor per module.",
    where: "quiz.generate routers.ts:864 · schema.ts:145" },
  { title: "Quiz scoring is unguarded against edge inputs", severity: "med",
    problem: "Score is correct / questions.length. A quiz with zero questions would divide by zero (NaN score). The submitted answers array length isn't validated against the number of questions, so a short array silently scores missing answers as wrong.",
    fix: "Guard questions.length > 0 and validate answers.length === questions.length before scoring.",
    where: "quiz.submit routers.ts:888–893" },
  { title: "Approval checks are copy-pasted, and one is missing", severity: "med",
    problem: "approvalStatus !== 'approved' is repeated inline across many procedures instead of enforced once in shared middleware. progress.update has no such check at all — inconsistent, and a trap when adding new procedures.",
    fix: "Add an approvedProcedure middleware and use it everywhere trainees act.",
    where: "trpc.ts:28 · scattered in routers.ts · missing at routers.ts:725" },
  { title: "Storage-not-configured path unclear", severity: "low",
    problem: "Video upload calls storagePut directly. If S3/R2 vars are unset (a common early-rollout state), it's unclear whether the trainee sees a friendly message or a 500.",
    fix: "Detect missing storage config and show 'video uploads aren't set up yet' instead of an error.",
    where: "index.ts:101–112" },
  { title: "Generic login error only", severity: "low",
    problem: "Login returns one 'Invalid email or password' for every failure. Good for security, but a locked-out new hire can't tell 'wrong password' from 'no account yet'.",
    fix: "Consider a gentle 'ask your admin to create your account' hint on the login page.",
    where: "auth.login routers.ts:46–50" },
  { title: "Weak password policy", severity: "low",
    problem: "Passwords require only 8 characters, no complexity. Acceptable, but worth a deliberate decision before selling to teams handling patient-adjacent data.",
    where: "resetPassword routers.ts:83 · changePassword routers.ts:95" },
];

const SIMPLIFICATIONS = [
  "Collapse account + role into one step. A new hire should never exist without a role. Kills the Critical dead-end.",
  "Remove or activate the approval system. Pick one path; delete the other. Less surface to test, explain, and sell.",
  "One definition of 'done'. Fold test-out mastery into onboarding completion for a single trustworthy 'ready' signal.",
  "Flag milestones as test-outs explicitly. Replace title-keyword matching with an isTestOut checkbox.",
  "Centralize the 'approved' gate. One middleware instead of a dozen inline copies.",
];

const SEV: Record<Severity, { label: string; text: string; bg: string; stripe: string }> = {
  crit: { label: "Critical", text: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40", stripe: "bg-red-500" },
  high: { label: "High", text: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950/40", stripe: "bg-orange-500" },
  med: { label: "Medium", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", stripe: "bg-amber-500" },
  low: { label: "Low", text: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800/50", stripe: "bg-slate-400" },
};

function SevBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity];
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.text} ${s.bg}`}>
      {s.label}
    </span>
  );
}

export default function AdminUAT() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  if (loading) return null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Acceptance Test Pack</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Persona-driven pre-sale QA — 32 checks across two new-hire journeys, plus findings and simplifications.
            </p>
          </div>
        </div>

        {/* Method note */}
        <Card className="mb-6 border-amber-300/60 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                <span className="font-semibold">Method &amp; honesty note.</span> These checks and findings were
                produced by tracing every step through the actual code — not yet by an automated run against a live
                instance. Every finding cites the exact file and line. Expected results describe how the server is
                <em> written</em> to behave; run the manual pass to confirm the UI matches on real devices with real content.
                This report is admin-only by design.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personas */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {PERSONAS.map((p) => (
            <Card key={p.initials}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {p.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground leading-tight">{p.name}</p>
                    <p className="text-xs font-medium text-primary">{p.role}</p>
                  </div>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Starting state</dt>
                    <dd className="text-muted-foreground">{p.start}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Goal</dt>
                    <dd className="text-muted-foreground">{p.goal}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">"Done" looks like</dt>
                    <dd className="text-muted-foreground">{p.done}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Journeys */}
        {JOURNEYS.map((j) => (
          <Card key={j.id} className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {j.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{j.subtitle}</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                      <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Step</th>
                      <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Expected result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.checks.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 align-top">
                        <td className="py-2.5 px-2">
                          <span className="font-mono text-xs font-semibold text-primary">{c.id}</span>
                        </td>
                        <td className="py-2.5 px-2 text-foreground/90 min-w-[13rem]">{c.step}</td>
                        <td className="py-2.5 px-2 min-w-[13rem]">
                          <span className={c.watch ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                            {c.watch && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
                            {c.expected}
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground/70 mt-1">{c.loc}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Findings */}
        <div className="mt-8 mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Findings &amp; gaps</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Eleven items found tracing the journeys, worst first. Each is grounded in a specific line.</p>
        <div className="space-y-3">
          {FINDINGS.map((f) => {
            const s = SEV[f.severity];
            return (
              <div key={f.title} className="flex rounded-xl border border-border overflow-hidden bg-card">
                <div className={`w-1 shrink-0 ${s.stripe}`} />
                <div className="p-4 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h4 className="font-bold text-foreground flex-1 min-w-[12rem]">{f.title}</h4>
                    <SevBadge severity={f.severity} />
                  </div>
                  <p className="text-sm text-muted-foreground">{f.problem}</p>
                  {f.fix && (
                    <p className="text-sm text-foreground/80 mt-2">
                      <span className="font-semibold text-primary">Fix:</span> {f.fix}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-muted-foreground/70 mt-2">{f.where}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Simplifications */}
        <div className="mt-8 mb-3 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Simplifications</h2>
        </div>
        <Card>
          <CardContent className="py-4">
            <ol className="space-y-2 text-sm text-foreground/90 list-decimal pl-5">
              {SIMPLIFICATIONS.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Before you sell */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-2">Before you sell — the short list</h2>
          <Card>
            <CardContent className="py-4 space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <SevBadge severity="crit" />
                <span className="text-foreground/90">Make team role required at account creation (no stranded new hires).</span>
              </p>
              <p className="flex items-start gap-2">
                <SevBadge severity="high" />
                <span className="text-foreground/90">Decide onboarding-complete = modules <em>and</em> test-outs, so "done" means done.</span>
              </p>
              <p className="text-muted-foreground pt-1">
                Then run the 32 checks on a real phone and laptop with a real track loaded. The next investment is turning
                this pack into an automated suite — a seed script for the two personas and a run that walks A→F on every deploy.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground/70 mt-8 leading-relaxed">
          Findings derived from static review of the codebase at this branch; line references may shift as code changes.
          Run the manual checks against a non-production instance with disposable accounts. Nothing here has been executed against live data.
        </p>
      </div>
    </AppLayout>
  );
}
