import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import GamificationCard from "@/components/GamificationCard";
import { trpc } from "@/lib/trpc";
import { firstName } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  GraduationCap,
  Library,
  Lock,
  Map,
  PlayCircle,
  Sparkles,
  Trophy,
  Video,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";// ── Chiropractic tips shown randomly on each login ────────────────────────────────────────────
const DAILY_TIPS = [
  "The nervous system controls and coordinates every cell, tissue, and organ in the body — it is the master system.",
  "A subluxation is not just a misaligned bone. It is a disruption in the neurological communication between the brain and body.",
  "Everything in the universe has an organizing intelligence that keeps it functioning. In the human body, we call that innate intelligence. (Principle 1)",
  "The goal of a chiropractic adjustment is not to treat a symptom — it is to restore the body’s innate ability to heal itself.",
  "Your innate intelligence is always working perfectly. When something goes wrong, the problem is never the intelligence — it is interference in how that intelligence expresses itself through the body. (Principle 20)",
  "Every adjustment is intentional. Identifying the right segment, the right direction, and the right moment is what separates specific chiropractic care from general manipulation.",
  "The body is constantly adapting its internal environment to outside forces. Chiropractic helps ensure that adaptation happens with full neurological capacity. (Principle 23)",
  "Neurological tone is one important indicator of how the nervous system is functioning. Elevated tone often reflects sympathetic dominance — a state of chronic stress that keeps the body from healing, growing, and regulating properly.",
  "The body is always doing its best with what it has. Our job is to remove interference so it can do more.",
  "Innate intelligence is the organizing force within every living body. Chiropractic honors and restores its expression.",
  "A child’s nervous system is not a small adult’s — it is actively developing. Early interference has long-term consequences.",
  "Fight-or-flight is a survival state, not a living state. Chronic sympathetic dominance is the root of dysregulation.",
  "When the nervous system is compressed or irritated, the body's ability to communicate with itself breaks down. That breakdown is the root of dis-ease — not germs, not genetics. (Principle 29)",
  "Regulation is the nervous system’s ability to move fluidly between states of activation and rest. Chiropractic supports that flexibility.",
  "Every organ, tissue, and cell in the body works in harmony when the nervous system is clear. Chiropractic restores that coordination. (Principle 32)",
  "Healing is not instant — it takes time. The body rebuilds on its own timeline, and consistent care respects that process. (Principle 6)",
  "Healing happens from above-down, inside-out. No pill, therapy, or surgery can replicate what the body does when interference is removed.",
  "The vagus nerve is the body’s primary rest-and-digest pathway. Cervical and thoracic alignment directly influence vagal tone.",
  "Subluxations accumulate silently. By the time symptoms appear, the nervous system has been compensating for a long time.",
  "Chiropractic does not treat conditions. It removes the interference that prevents the body from expressing its full potential.",
];
function getDailyTip(): string {  // Stable per-session (changes on refresh/login)
  const idx = Math.floor(Math.random() * DAILY_TIPS.length);
  return DAILY_TIPS[idx];
}

const ROLE_LABELS: Record<string, string> = {
  ca: "Chiropractic Assistant",
  associate_doctor: "Associate Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

const TEST_OUT_KEYWORDS = ["test out", "check-in", "check in", "60-day", "60 day"];
function isTestOut(title: string) {
  return TEST_OUT_KEYWORDS.some(k => title.toLowerCase().includes(k));
}

// ── Circular progress ring ───────────────────────────────────────────────────
function ProgressRing({ pct, size = 72, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="white" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

// ── Past Weeks (collapsible) ─────────────────────────────────────────────────
function PastWeeksSection({ pastMilestones, setLocation }: { pastMilestones: any[]; setLocation: (p: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div>
      <button
        onClick={() => setShowAll(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border bg-white hover:bg-secondary/40 transition-colors text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Completed Weeks ({pastMilestones.length})
        </span>
        {showAll ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showAll && (
        <div className="space-y-2 mt-2">
          {pastMilestones.map((ms) => {
            const msTotal = ms.modules.length;
            const msDone = ms.modules.filter((m: any) => m.progress?.status === "completed").length;
            const isExpanded = expandedId === ms.id;
            return (
              <div key={ms.id} className="rounded-2xl border border-border bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ms.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ms.title}</p>
                    <p className="text-xs text-muted-foreground">{msDone}/{msTotal} modules complete</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {ms.modules.map((mod: any) => {
                      const isDone = mod.progress?.status === "completed";
                      const TypeIcon = { sop: BookOpen, video: Video, task: CheckCircle2, checklist: CheckCircle2 }[mod.type as string] ?? BookOpen;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => setLocation(`/modules/${mod.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? "bg-primary/10" : "bg-secondary"}`}>
                            {isDone ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <TypeIcon className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <p className={`text-sm flex-1 min-w-0 truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{mod.title}</p>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [dailyTip] = useState(() => getDailyTip());

  const trackQuery = trpc.tracks.myTrack.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });
  const notificationsQuery = trpc.notifications.mine.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => notificationsQuery.refetch(),
  });

  const isAdmin = user?.role === "admin";
  const track = trackQuery.data;
  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter(n => !n.isRead);

  const trainingMilestones = track?.milestones.filter(ms => !isTestOut(ms.title)) ?? [];

  let totalModules = 0;
  let completedModules = 0;
  for (const ms of trainingMilestones) {
    for (const mod of ms.modules) {
      totalModules++;
      if (mod.progress?.status === "completed") completedModules++;
    }
  }
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const currentMilestoneIdx = trainingMilestones.findIndex(ms =>
    ms.modules.some(m => m.progress?.status !== "completed")
  );
  const currentMilestone = currentMilestoneIdx >= 0 ? trainingMilestones[currentMilestoneIdx] : null;
  const pastMilestones = currentMilestoneIdx > 0 ? trainingMilestones.slice(0, currentMilestoneIdx) : [];

  const incompleteModules = currentMilestone?.modules.filter(m => m.progress?.status !== "completed") ?? [];
  const totalCurrentWeek = currentMilestone?.modules.length ?? 0;
  const completedCurrentWeek = totalCurrentWeek - incompleteModules.length;

  // ── Test-out countdown (all hooks must be before any early return) ───────────────────────
  // Auto-advance testOutDate weekly: if the stored date is in the past, roll it
  // forward by 7-day increments until it's upcoming (preserves the day-of-week).
  const testOutDate = useMemo(() => {
    if (!user || !(user as any).testOutDate) return null;
    // The test-out date is a *calendar day*, but it's stored as a UTC-midnight
    // timestamp. Rebuild it from its Y/M/D parts as a LOCAL date so it shows the
    // same day the admin picked in every timezone (a plain `new Date(stored)`
    // would render UTC midnight as the previous evening — and previous day — for
    // US viewers).
    const raw = (user as any).testOutDate;
    const iso = typeof raw === "string" ? raw : new Date(raw).toISOString();
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const stored = new Date(y, m - 1, d);
    const now = new Date();
    // Set "now" to start of today so same-day still counts as upcoming
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const candidate = new Date(stored);
    while (candidate < today) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }, [user]);

  const testOutInfo = useMemo(() => {
    if (!testOutDate || !currentMilestone) return null;
    const now = new Date();
    // Count whole days from the start of today to the (local-midnight) test-out
    // day, so "today" reads 0 and "tomorrow" reads 1 regardless of the time of day.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntil = Math.round((testOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalRequired = currentMilestone.modules.length;
    const completedRequired = currentMilestone.modules.filter((m: any) => m.progress?.status === "completed").length;
    const remaining = totalRequired - completedRequired;
    let urgency: "normal" | "warning" | "urgent";
    if (daysUntil <= 1) urgency = "urgent";
    else if (daysUntil <= 3) urgency = "warning";
    else urgency = "normal";
    return { daysUntil, totalRequired, completedRequired, remaining, urgency, date: testOutDate };
  }, [testOutDate, currentMilestone]);

  useMemo(() => {
    if (loading) return;
    if (!user) { window.location.href = getLoginUrl(); }
  }, [user, loading]);

  if (loading || !user) return null;

  const userFirstName = firstName(user.name);
  const userRoleLabel = user.teamRole ? ROLE_LABELS[user.teamRole] : (isAdmin ? "Admin" : "Team Member");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Quick-action cards for navigation
  const quickActions = [
    { icon: Map, label: "My Track", desc: "Full training path", path: "/my-track", color: "oklch(0.93 0.030 135)" },
    { icon: BookOpen, label: "SOPs", desc: "Reference library", path: "/sops", color: "oklch(0.93 0.025 220)" },
    { icon: Library, label: "Learning Library", desc: "Videos & resources", path: "/library", color: "oklch(0.93 0.025 60)" },
    { icon: Activity, label: "Submissions", desc: "Questions & videos", path: "/submissions", color: "oklch(0.93 0.025 300)" },
  ];

  return (
    <AppLayout>
      <div className="min-h-full" style={{ background: 'oklch(0.97 0.008 135)' }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">

          {/* ── HERO CARD ── */}
          <div className="hero-card p-6 relative z-0">
            {/* Greeting */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-white/70 text-sm font-medium mb-0.5">{greeting},</p>
                <h1 className="text-2xl font-bold text-white leading-tight">{userFirstName}</h1>
                <p className="text-white/60 text-xs mt-1">{userRoleLabel} · Reformation Chiropractic</p>
              </div>
              {/* Progress ring */}
              <div className="relative shrink-0">
                <ProgressRing pct={progressPct} size={68} stroke={5} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-base leading-none">{progressPct}%</span>
                </div>
              </div>
            </div>

            {/* Current week pill */}
            {currentMilestone && (
              <div className="flex items-center gap-2 mb-5">
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
                  <Clock className="h-3 w-3 text-white/80" />
                  <span className="text-white/90 text-xs font-medium">
                    Week {currentMilestone.weekNumber} · {completedCurrentWeek}/{totalCurrentWeek} done
                  </span>
                </div>
              </div>
            )}

            {/* Start Today CTA */}
            <button
              onClick={() => setLocation("/daily-focus")}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98] hover:shadow-md"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-light)' }}>
                  <Sparkles className="h-4.5 w-4.5" style={{ width: '18px', height: '18px', color: 'var(--brand-dark)' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground leading-tight">Start Today's Focus</p>
                  <p className="text-xs text-muted-foreground">{incompleteModules.length > 0 ? `${incompleteModules.length} module${incompleteModules.length !== 1 ? 's' : ''} remaining` : "All caught up!"}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* ── GAMIFICATION CARD ── */}
          {track && <GamificationCard />}

          {/* ── TEST-OUT COUNTDOWN CARD ── */}
          {testOutInfo && (() => {
            const { daysUntil, totalRequired, completedRequired, remaining, urgency, date } = testOutInfo;
            const urgencyConfig = {
              normal:  { bg: 'oklch(0.97 0.012 135)', border: 'oklch(0.88 0.030 135)', accent: 'oklch(0.45 0.15 135)', icon: CalendarClock, label: 'Test-Out Coming Up', textColor: 'oklch(0.35 0.12 135)' },
              warning: { bg: 'oklch(0.97 0.025 70)',  border: 'oklch(0.88 0.060 70)',  accent: 'oklch(0.55 0.18 70)',  icon: AlertTriangle,  label: 'Test-Out Soon!',    textColor: 'oklch(0.40 0.15 70)'  },
              urgent:  { bg: 'oklch(0.97 0.025 25)',  border: 'oklch(0.88 0.060 25)',  accent: 'oklch(0.55 0.20 25)',  icon: AlertTriangle,  label: 'Test-Out This Week!', textColor: 'oklch(0.40 0.18 25)' },
            }[urgency];
            const Icon = urgencyConfig.icon;
            const pct = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;
            return (
              <div
                className="rounded-2xl px-4 py-4"
                style={{ background: urgencyConfig.bg, border: `1.5px solid ${urgencyConfig.border}` }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: urgencyConfig.accent + '22' }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: urgencyConfig.accent }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: urgencyConfig.accent }}>{urgencyConfig.label}</p>
                      <p className="text-xs font-semibold" style={{ color: urgencyConfig.textColor }}>
                        {daysUntil === 0
                          ? 'Today!'
                          : daysUntil === 1
                          ? 'Tomorrow'
                          : `${daysUntil} days — ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: urgencyConfig.accent }}>{pct}%</p>
                    <p className="text-[10px] text-muted-foreground">ready</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full mb-3" style={{ background: urgencyConfig.border }}>
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: urgencyConfig.accent }}
                  />
                </div>
                {/* Module status */}
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: urgencyConfig.textColor }}>
                    <span className="font-bold">{completedRequired}/{totalRequired}</span> this week's modules done
                  </p>
                  {remaining > 0 && (
                    <button
                      onClick={() => setLocation('/daily-focus')}
                      className="text-xs font-semibold px-3 py-1 rounded-full transition-all active:scale-95"
                      style={{ background: urgencyConfig.accent, color: 'white' }}
                    >
                      {remaining} left → Start
                    </button>
                  )}
                  {remaining === 0 && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: urgencyConfig.accent + '22', color: urgencyConfig.accent }}>
                      ✓ All done!
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── DAILY TIP ── */}
          <div
            className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
            style={{ background: 'oklch(0.95 0.025 135)', border: '1px solid oklch(0.88 0.030 135)' }}
          >
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Daily Insight</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{dailyTip}</p>
            </div>
          </div>
          {/* ── STAT TILES ── */}
          {track && (
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-tile">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Done</span>
                <span className="text-2xl font-bold text-primary">{completedModules}</span>
                <span className="text-[10px] text-muted-foreground">modules</span>
              </div>
              <div className="stat-tile">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Left</span>
                <span className="text-2xl font-bold text-foreground">{totalModules - completedModules}</span>
                <span className="text-[10px] text-muted-foreground">modules</span>
              </div>
              <div className="stat-tile">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Week</span>
                <span className="text-2xl font-bold text-foreground">{currentMilestone?.weekNumber ?? "—"}</span>
                <span className="text-[10px] text-muted-foreground">current</span>
              </div>
            </div>
          )}

          {/* ── QUICK ACTIONS ── */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">Quick Access</p>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => setLocation(action.path)}
                  className="action-card flex items-center gap-3 text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: action.color }}
                  >
                    <action.icon className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── NOTIFICATIONS (unread only, compact) ── */}
          {unread.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-0.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Notifications
                  <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{unread.length}</span>
                </p>
                <button onClick={() => markAllRead.mutate()} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              </div>
              <div className="space-y-2">
                {unread.slice(0, 3).map((n) => {
                  const notifUrl = (() => {
                    switch (n.type) {
                      case 'question_submitted': return `/admin/submissions?tab=questions${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                      case 'video_submitted': return `/admin/submissions?tab=videos${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                      case 'question_answered': return `/submissions?tab=questions${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                      case 'video_reviewed': return `/submissions?tab=videos${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                      default: return null;
                    }
                  })();
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (notifUrl) { markAllRead.mutate(); setLocation(notifUrl); } }}
                      className="bg-white rounded-2xl border border-primary/20 px-4 py-3 flex items-start gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                      {notifUrl && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ADMIN: All Weeks Overview ── */}
          {isAdmin && track && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">All Weeks</p>
              <div className="space-y-2">
                {trainingMilestones.map((ms) => {
                  const msTotal = ms.modules.length;
                  const msDone = ms.modules.filter(m => m.progress?.status === "completed").length;
                  const msPct = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;
                  const isCurrent = currentMilestone?.id === ms.id;
                  return (
                    <button
                      key={ms.id}
                      onClick={() => setLocation(`/modules/${ms.modules[0]?.id ?? ""}`)}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border text-left transition-all hover:shadow-sm active:scale-[0.99]"
                      style={{ borderColor: isCurrent ? 'var(--brand-mid)' : 'oklch(0.92 0.010 135)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{
                          background: msPct === 100 ? 'var(--brand-light)' : 'oklch(0.95 0.010 135)',
                          color: msPct === 100 ? 'var(--brand-dark)' : 'oklch(0.45 0.04 135)',
                        }}
                      >
                        {msPct === 100 ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--brand-dark)' }} /> : `W${ms.weekNumber}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{ms.title}</p>
                        <p className="text-xs text-muted-foreground">{msDone}/{msTotal} modules</p>
                      </div>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full progress-bar" style={{ width: `${msPct}%`, background: 'var(--brand-mid)' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TRAINEE: Past Weeks (collapsible) ── */}
          {!isAdmin && pastMilestones.length > 0 && (
            <PastWeeksSection pastMilestones={pastMilestones} setLocation={setLocation} />
          )}

          {/* ── No track assigned ── */}
          {!track && !trackQuery.isLoading && (
            <div className="bg-white rounded-2xl border border-border p-8 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Your training track will appear here once your role is assigned.</p>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
