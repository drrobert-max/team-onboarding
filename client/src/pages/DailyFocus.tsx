import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  PlayCircle,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const TEST_OUT_KEYWORDS = ["test out", "check-in", "check in", "60-day", "60 day"];
function isTestOut(title: string) {
  const lower = title.toLowerCase();
  return TEST_OUT_KEYWORDS.some(k => lower.includes(k));
}

/** Practice items reset daily — anything with "practice" in the title */
function isPracticeItem(title: string) {
  return title.toLowerCase().includes("practice");
}

function daysUntilNextThursday(): number {
  const day = new Date().getDay();
  const diff = (4 - day + 7) % 7;
  return diff === 0 ? 0 : diff;
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function scoreModule(
  mod: { type: string; title: string },
  status: string | undefined,
  daysLeft: number
): number {
  if (status === "completed" && !isPracticeItem(mod.title)) return -1;
  let score = 10;
  if (mod.type === "video") score += 3;
  if (mod.type === "sop") score += 2;
  if (mod.type === "task") score += 1;
  if (isPracticeItem(mod.title)) score += 4; // always surface practice items
  if (status === "in_progress") score += 5;
  if (daysLeft <= 1) score += 8;
  else if (daysLeft <= 2) score += 5;
  else if (daysLeft <= 3) score += 3;
  return score;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  sop: BookOpen,
  video: PlayCircle,
  task: CheckCircle2,
  checklist: CheckCircle2,
};

const TYPE_LABELS: Record<string, string> = {
  sop: "SOP",
  video: "Video",
  task: "Task",
  checklist: "Checklist",
};

export default function DailyFocus() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const daysLeft = useMemo(() => daysUntilNextThursday(), []);
  const todayLabel = useMemo(() => getTodayLabel(), []);

  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.href = getLoginUrl(); return; }
  }, [user, loading]);

  const trackQuery = trpc.tracks.myTrack.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });
  const checkinsQuery = trpc.dailyFocus.todayCheckins.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });
  const utils = trpc.useUtils();

  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);

  // For non-practice items: permanently mark complete in track
  const completeModuleMutation = trpc.progress.update.useMutation({
    onSuccess: (_data, variables) => {
      utils.tracks.myTrack.invalidate();
      checkinsQuery.refetch();
      if (variables.status === "completed") {
        setJustCompleted(variables.moduleId);
        toast.success("Module complete! 🎉", {
          description: "Synced to your training dashboard.",
          duration: 3000,
        });
        // Confetti burst
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#4ade80", "#22c55e", "#16a34a", "#bbf7d0", "#ffffff"],
          scalar: 0.9,
          gravity: 1.2,
        });
        setTimeout(() => setJustCompleted(null), 1200);
      }
    },
  });

  // For practice items: daily checkin only
  const toggleCheckinMutation = trpc.dailyFocus.toggle.useMutation({
    onSuccess: (_data, variables) => {
      checkinsQuery.refetch();
      // Fire confetti when checking off (not unchecking)
      if (!checkedIds.has(variables.moduleId)) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#fb923c", "#f97316", "#fbbf24", "#fde68a", "#ffffff"],
          scalar: 0.85,
          gravity: 1.2,
        });
      }
    },
  });

  if (loading || !user) return null;

  const track = trackQuery.data;
  const checkins = checkinsQuery.data ?? [];
  const checkedIds = new Set(checkins.map(c => c.moduleId));

  const trainingMilestones = track?.milestones.filter(ms => !isTestOut(ms.title)) ?? [];
  const currentMilestone = trainingMilestones.find(ms =>
    ms.modules.some(m => m.progress?.status !== "completed")
  );

  const focusItems = currentMilestone
    ? currentMilestone.modules
        .map(mod => ({
          ...mod,
          score: scoreModule(mod, mod.progress?.status ?? undefined, daysLeft),
          isPractice: isPracticeItem(mod.title),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
    : [];

  // "checked" = either daily checkin OR permanently completed in track
  const isItemChecked = (mod: typeof focusItems[number]) => {
    if (mod.isPractice) return checkedIds.has(mod.id);
    return mod.progress?.status === "completed" || checkedIds.has(mod.id);
  };

  const completedCount = focusItems.filter(m => isItemChecked(m)).length;
  const allChecked = focusItems.length > 0 && completedCount === focusItems.length;

  const totalCurrentWeek = currentMilestone?.modules.length ?? 0;
  const completedInTrack = currentMilestone?.modules.filter(m => m.progress?.status === "completed").length ?? 0;
  const weekPct = totalCurrentWeek > 0 ? Math.round((completedInTrack / totalCurrentWeek) * 100) : 100;
  const isReady = currentMilestone?.modules.every(m => m.progress?.status === "completed") ?? true;
  const isAlmost = !isReady && weekPct >= 50 && daysLeft >= 2;
  const readiness = isReady ? "ready" : isAlmost ? "almost" : "not_ready";

  function handleToggle(mod: typeof focusItems[number]) {
    if (mod.isPractice) {
      // Daily reset only
      toggleCheckinMutation.mutate({ moduleId: mod.id });
    } else {
      const alreadyComplete = mod.progress?.status === "completed";
      if (alreadyComplete) {
        // Unmark: set back to in_progress
        completeModuleMutation.mutate({ moduleId: mod.id, status: "in_progress" });
      } else {
        // Mark permanently complete
        completeModuleMutation.mutate({ moduleId: mod.id, status: "completed" });
      }
    }
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto pb-4">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Daily Focus</h1>
          </div>
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
        </div>

        {/* Daily Progress Bar */}
        {focusItems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Today's Focus</span>
              <span className="text-xs font-semibold text-foreground">{completedCount}/{focusItems.length} done</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-colors ${
                  completedCount === focusItems.length
                    ? "bg-emerald-500"
                    : completedCount > 0
                    ? "bg-primary"
                    : "bg-primary/40"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${focusItems.length > 0 ? Math.round((completedCount / focusItems.length) * 100) : 0}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            {completedCount === focusItems.length && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 text-center">All done for today! 🎉</p>
            )}
          </div>
        )}
        {/* Test Out Countdown */}
        <div className={`rounded-xl border p-3 mb-5 flex items-center gap-3 ${
          readiness === "ready"
            ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30"
            : readiness === "almost"
            ? "border-amber-400/40 bg-amber-50 dark:bg-amber-950/30"
            : "border-red-400/40 bg-red-50 dark:bg-red-950/30"
        }`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            readiness === "ready" ? "bg-emerald-500/15" : readiness === "almost" ? "bg-amber-400/15" : "bg-red-400/15"
          }`}>
            {readiness === "ready" ? (
              <CalendarCheck className="h-5 w-5 text-emerald-600" />
            ) : readiness === "almost" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${
              readiness === "ready" ? "text-emerald-700 dark:text-emerald-400"
              : readiness === "almost" ? "text-amber-700 dark:text-amber-400"
              : "text-red-700 dark:text-red-400"
            }`}>
              {readiness === "ready" ? "On Track for Test Out" : readiness === "almost" ? "Almost Ready — Keep Going" : "Not Ready — Action Needed"}
            </p>
            <p className="text-xs text-muted-foreground">
              {daysLeft === 0 ? "Test Out is today — Thursday"
                : daysLeft === 1 ? "Test Out is tomorrow — Thursday"
                : `Test Out in ${daysLeft} days — Thursday`}
              {" · "}{weekPct}% of {currentMilestone?.title ?? "this week"} complete
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLocation("/test-outs")}
            className="shrink-0 text-xs px-2"
          >
            View
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>

        {/* No role / no track */}
        {!user.teamRole && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Your admin hasn't assigned your training track yet. Check back soon.
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {trackQuery.isLoading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Focus list */}
        {!trackQuery.isLoading && focusItems.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Today's Focus — {currentMilestone?.title}
              </h2>
              <button
                onClick={() => setHideCompleted(h => !h)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {hideCompleted ? (
                  <><Eye className="h-3.5 w-3.5" /> Show all</>
                ) : (
                  <><EyeOff className="h-3.5 w-3.5" /> Hide done</>
                )}
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${focusItems.length > 0 ? (completedCount / focusItems.length) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-2">
              {focusItems.filter(mod => !hideCompleted || !isItemChecked(mod)).map((mod) => {
                const isChecked = isItemChecked(mod);
                const Icon = mod.isPractice ? Dumbbell : (TYPE_ICONS[mod.type] ?? CheckCircle2);

                return (
                  <motion.div
                    key={mod.id}
                    layout
                    animate={justCompleted === mod.id ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={`rounded-xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer select-none ${
                      isChecked
                        ? "border-primary/30 bg-primary/5 opacity-70"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                    }`}
                    onClick={() => handleToggle(mod)}
                  >
                    {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isChecked ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {isChecked && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isChecked ? "bg-primary/10" : mod.isPractice ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted"
                    }`}>
                      <Icon className={`h-4 w-4 ${isChecked ? "text-primary" : mod.isPractice ? "text-amber-600" : "text-muted-foreground"}`} />
                    </div>

                    {/* Title + badges */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {mod.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {mod.isPractice ? (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            <RefreshCw className="h-2.5 w-2.5" />
                            Practice · resets daily
                          </span>
                        ) : (
                          <>
                            <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[mod.type]}</span>
                            {mod.progress?.status === "completed" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600">
                                Completed
                              </Badge>
                            )}
                            {mod.progress?.status === "in_progress" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400/40 text-amber-600">
                                In progress
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Open module */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/modules/${mod.id}`);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                );
              })}
              <AnimatePresence />
            </div>

            {/* All checked message */}
            {allChecked && (
              <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Great work today!</p>
                <p className="text-xs text-muted-foreground mt-0.5">All focus items done. Practice items will reset tomorrow.</p>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center mt-4">
              Videos, SOPs &amp; tasks mark permanently complete. Practice items reset each morning.
            </p>
          </>
        )}

        {/* All done / no modules */}
        {!trackQuery.isLoading && user.teamRole && focusItems.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No focus items for today. You're on track.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
