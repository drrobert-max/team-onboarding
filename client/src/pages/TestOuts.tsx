import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock,
  Eye,
  Lock,
  PlayCircle,
  RefreshCw,
  Star,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const ROLE_LABELS: Record<string, string> = {
  ca: "Chiropractic Assistant",
  associate_doctor: "Associate Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

const STATUS_CONFIG = {
  completed: { label: "Completed", icon: CheckCircle2, className: "badge-completed" },
  in_progress: { label: "In Progress", icon: Clock, className: "badge-in-progress" },
  not_started: { label: "Not Started", icon: Lock, className: "badge-not-started" },
  needs_review: { label: "Needs Review", icon: RefreshCw, className: "badge-needs-review" },
};

const TYPE_ICONS = {
  sop: BookOpen,
  video: Video,
  task: CheckCircle2,
  checklist: CheckCircle2,
};

const TEST_OUT_KEYWORDS = ["test out", "check-in", "check in", "60-day", "60 day"];

function isTestOut(title: string) {
  const lower = title.toLowerCase();
  return TEST_OUT_KEYWORDS.some(k => lower.includes(k));
}

function GradeBadge({ grade }: { grade: "mastered" | "needs_improvement" }) {
  if (grade === "mastered") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <Star className="h-2.5 w-2.5" />
        Mastered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      <AlertCircle className="h-2.5 w-2.5" />
      Needs Improvement
    </span>
  );
}

function GradeButtons({
  userId,
  moduleId,
  milestoneId,
  currentGrade,
  onGraded,
}: {
  userId: number;
  moduleId: number;
  milestoneId: number;
  currentGrade?: "mastered" | "needs_improvement";
  onGraded: () => void;
}) {
  const utils = trpc.useUtils();
  const setGrade = trpc.grading.setGrade.useMutation({
    onSuccess: () => {
      utils.grading.getForUser.invalidate({ userId });
      onGraded();
    },
  });

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <Button
        size="sm"
        variant={currentGrade === "mastered" ? "default" : "outline"}
        className={`h-6 text-[10px] px-2 py-0 gap-1 ${currentGrade === "mastered" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"}`}
        onClick={() => setGrade.mutate({ userId, moduleId, milestoneId, grade: "mastered" })}
        disabled={setGrade.isPending}
      >
        <Star className="h-2.5 w-2.5" />
        Mastered
      </Button>
      <Button
        size="sm"
        variant={currentGrade === "needs_improvement" ? "default" : "outline"}
        className={`h-6 text-[10px] px-2 py-0 gap-1 ${currentGrade === "needs_improvement" ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"}`}
        onClick={() => setGrade.mutate({ userId, moduleId, milestoneId, grade: "needs_improvement" })}
        disabled={setGrade.isPending}
      >
        <AlertCircle className="h-2.5 w-2.5" />
        Needs Improvement
      </Button>
    </div>
  );
}

export default function TestOuts() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const trackQuery = trpc.tracks.myTrack.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });

  const usersQuery = trpc.users.list.useQuery(undefined, { enabled: isAdmin });

  const viewingUserId = isAdmin ? (selectedUserId ?? user?.id ?? null) : (user?.id ?? null);

  const gradesQuery = trpc.grading.getForUser.useQuery(
    { userId: viewingUserId! },
    { enabled: viewingUserId !== null }
  );

  // Build grade map and carry-forward map
  const gradeMap = new Map<string, "mastered" | "needs_improvement">();
  const carryForwardMap = new Map<number, { moduleId: number; fromMilestoneTitle: string }[]>();

  if (gradesQuery.data) {
    for (const g of gradesQuery.data) {
      gradeMap.set(`${g.moduleId}-${g.milestoneId}`, g.grade);
      if (g.grade === "needs_improvement" && g.carriedToMilestoneId) {
        if (!carryForwardMap.has(g.carriedToMilestoneId)) {
          carryForwardMap.set(g.carriedToMilestoneId, []);
        }
        carryForwardMap.get(g.carriedToMilestoneId)!.push({
          moduleId: g.moduleId,
          fromMilestoneTitle: "",
        });
      }
    }
  }

  const track = trackQuery.data;
  const testOutMilestones = track?.milestones.filter(ms => isTestOut(ms.title)) ?? [];

  // Build module lookup for carry-forward display
  const allModules = new Map<number, { title: string; milestoneTitle: string }>();
  if (track) {
    for (const ms of track.milestones) {
      for (const mod of ms.modules) {
        allModules.set(mod.id, { title: mod.title, milestoneTitle: ms.title });
      }
    }
  }

  if (gradesQuery.data) {
    for (const g of gradesQuery.data) {
      if (g.grade === "needs_improvement" && g.carriedToMilestoneId) {
        const entries = carryForwardMap.get(g.carriedToMilestoneId) ?? [];
        for (const entry of entries) {
          if (entry.moduleId === g.moduleId) {
            const modInfo = allModules.get(g.moduleId);
            entry.fromMilestoneTitle = modInfo?.milestoneTitle ?? "";
          }
        }
      }
    }
  }

  // Determine unlock state for each test-out milestone.
  // A milestone is "passed" when every module in it has been graded "mastered" by admin.
  // The first milestone is always unlocked (Week 1 Check-In).
  // Each subsequent milestone unlocks only after the previous one is fully passed.
  const passedSet = new Set<number>(); // milestone IDs that are fully mastered
  for (const ms of testOutMilestones) {
    const allMastered =
      ms.modules.length > 0 &&
      ms.modules.every(m => gradeMap.get(`${m.id}-${ms.id}`) === "mastered");
    if (allMastered) passedSet.add(ms.id);
  }

  // Build the set of unlocked milestone IDs.
  // Week 0 (index 0) is always unlocked.
  // Week N unlocks when week N-1 is passed.
  const unlockedSet = new Set<number>();
  for (let i = 0; i < testOutMilestones.length; i++) {
    if (i === 0) {
      unlockedSet.add(testOutMilestones[i].id);
    } else if (passedSet.has(testOutMilestones[i - 1].id)) {
      unlockedSet.add(testOutMilestones[i].id);
    } else {
      break; // chain breaks — nothing further is unlocked
    }
  }

  // "Current" = the last unlocked milestone that is NOT yet fully passed.
  // If all are passed, current = last milestone.
  let currentTestOutIdx = 0;
  for (let i = 0; i < testOutMilestones.length; i++) {
    const ms = testOutMilestones[i];
    if (unlockedSet.has(ms.id)) {
      currentTestOutIdx = i;
      if (!passedSet.has(ms.id)) break; // stop at first unpassed unlocked week
    }
  }

  // Admin always sees all milestones; trainees only see unlocked + 1 preview.
  const visibleCount = isAdmin
    ? testOutMilestones.length
    : Math.min(currentTestOutIdx + 2, testOutMilestones.length); // current + 1 preview
  const visibleMilestones = testOutMilestones.slice(0, visibleCount);
  const hiddenCount = testOutMilestones.length - visibleCount;

  // Auto-expand current test-out on first render
  const currentMsId = testOutMilestones[currentTestOutIdx]?.id;
  const isExpanded = (id: number) => {
    // Default: current is expanded, others collapsed
    if (expandedIds.has(id)) return true;
    if (expandedIds.has(-id)) return false; // explicitly collapsed
    return id === currentMsId;
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      const currently = isExpanded(id);
      if (currently) {
        next.delete(id);
        next.add(-id); // mark explicitly collapsed
      } else {
        next.add(id);
        next.delete(-id);
      }
      return next;
    });
  };

  // Stats (only visible milestones)
  let totalModules = 0;
  let completedModules = 0;
  for (const ms of visibleMilestones) {
    totalModules += ms.modules.length;
    completedModules += ms.modules.filter(m => m.progress?.status === "completed").length;
  }
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const approvedUsers = (usersQuery.data ?? []).filter(
    (u: any) => u.approvalStatus === "approved" && u.teamRole
  );

  if (!track && !trackQuery.isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="text-center py-20">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No training track assigned</h2>
            <p className="text-muted-foreground text-sm">Your admin will assign your role and training track shortly.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Test Outs</h1>
          </div>
          {user?.teamRole && !isAdmin && (
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[user.teamRole]}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {isAdmin ? "Grade each trainee's test-out items." : "Your check-in and test-out requirements."}
          </p>
        </div>

        {/* Admin: trainee selector */}
        {isAdmin && approvedUsers.length > 0 && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Grading for</p>
              <Select
                value={String(viewingUserId ?? "")}
                onValueChange={(v) => setSelectedUserId(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a trainee..." />
                </SelectTrigger>
                <SelectContent>
                  {approvedUsers.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} — {ROLE_LABELS[u.teamRole] ?? u.teamRole}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Progress Summary */}
        {track && (
          <Card className="mb-6">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Test Out Progress</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{completedModules} of {totalModules} items complete</p>
                </div>
                <span className="text-2xl font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full progress-bar"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {trackQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-secondary rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : testOutMilestones.length === 0 ? (
          <div className="text-center py-20">
            <CircleCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">No test-out milestones found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMilestones.map((ms, idx) => {
              const isPassed = passedSet.has(ms.id);
              const isLocked = !unlockedSet.has(ms.id);
              const isPreview = !isAdmin && idx === visibleCount - 1 && idx > currentTestOutIdx;
              const isCurrent = idx === currentTestOutIdx;
              const msTotal = ms.modules.length;
              const msDone = ms.modules.filter(m => m.progress?.status === "completed").length;
              const msPct = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;
              const expanded = isExpanded(ms.id);

              const carried = carryForwardMap.get(ms.id) ?? [];
              const activeCarried = carried.filter(c => {
                const g = gradeMap.get(`${c.moduleId}-${ms.id}`);
                return g !== "mastered";
              });

              return (
                <div
                  key={ms.id}
                  id={`testout-${ms.id}`}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isCurrent
                      ? "border-primary/40 shadow-sm"
                      : isPreview
                      ? "border-dashed border-muted-foreground/30 bg-muted/30"
                      : "border-border"
                  }`}
                >
                  {/* Accordion Header — always visible */}
                  <button
                    onClick={() => toggleExpand(ms.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msPct === 100 ? "bg-primary/15" : isCurrent ? "bg-primary/10" : "bg-secondary"
                    }`}>
                      {msPct === 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : isPreview ? (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <span className="text-xs font-bold text-primary">W{ms.weekNumber}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isPreview ? "text-muted-foreground" : "text-foreground"}`}>
                          {ms.title}
                        </span>
                        {isCurrent && !isPassed && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            Current
                          </span>
                        )}
                        {isPassed && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Passed
                          </span>
                        )}
                        {isPreview && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                            <Eye className="h-2.5 w-2.5" />
                            Coming Up
                          </span>
                        )}
                        {isLocked && !isAdmin && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            Locked
                          </span>
                        )}
                      </div>
                      {!expanded && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {msDone}/{msTotal} items{activeCarried.length > 0 ? ` · ${activeCarried.length} carried forward` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isPreview && (
                        <span className="text-xs text-muted-foreground">{msDone}/{msTotal}</span>
                      )}
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Body */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/50">
                      {/* Preview notice */}
                      {isPreview && (
                        <div className="mb-3 p-3 rounded-xl bg-muted/50 border border-dashed border-muted-foreground/30">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span><strong>Coming up next week.</strong> Review these items now so you're prepared.</span>
                          </p>
                        </div>
                      )}

                      {/* Carry-forward items */}
                      {activeCarried.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Carried Forward — Needs Improvement
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeCarried.map((c) => {
                              const modInfo = allModules.get(c.moduleId);
                              const currentGrade = gradeMap.get(`${c.moduleId}-${ms.id}`);
                              return (
                                <div
                                  key={`cf-${c.moduleId}`}
                                  className="p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                                >
                                  <p className="text-xs font-medium text-foreground leading-snug">{modInfo?.title ?? `Module #${c.moduleId}`}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">From: {c.fromMilestoneTitle}</p>
                                  {currentGrade && <div className="mt-1.5"><GradeBadge grade={currentGrade} /></div>}
                                  {isAdmin && viewingUserId && (
                                    <GradeButtons
                                      userId={viewingUserId}
                                      moduleId={c.moduleId}
                                      milestoneId={ms.id}
                                      currentGrade={currentGrade}
                                      onGraded={() => {}}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Regular modules */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ms.modules.map((mod) => {
                          const status = mod.progress?.status ?? "not_started";
                          const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
                          const TypeIcon = TYPE_ICONS[mod.type as keyof typeof TYPE_ICONS] || BookOpen;
                          const currentGrade = gradeMap.get(`${mod.id}-${ms.id}`);

                          return (
                            <div
                              key={mod.id}
                              className={`module-card text-left p-4 rounded-xl border bg-card group transition-colors ${
                                currentGrade === "mastered"
                                  ? "border-emerald-200 dark:border-emerald-800"
                                  : currentGrade === "needs_improvement"
                                  ? "border-amber-200 dark:border-amber-800"
                                  : "border-border hover:border-primary/30"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  status === "completed" ? "bg-primary/15" :
                                  status === "in_progress" ? "bg-primary/10" : "bg-secondary"
                                }`}>
                                  {status === "completed" ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  ) : status === "in_progress" ? (
                                    <PlayCircle className="h-4 w-4 text-accent" />
                                  ) : (
                                    <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => !isPreview && setLocation(`/modules/${mod.id}`)}
                                    className={`text-sm font-medium text-left leading-snug transition-colors ${
                                      isPreview
                                        ? "text-muted-foreground cursor-default"
                                        : "text-foreground hover:text-primary group-hover:text-primary"
                                    }`}
                                  >
                                    {mod.title}
                                  </button>
                                  {!isPreview && (
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusCfg.className}`}>
                                        <statusCfg.icon className="h-2.5 w-2.5" />
                                        {statusCfg.label}
                                      </span>
                                      {currentGrade && <GradeBadge grade={currentGrade} />}
                                    </div>
                                  )}
                                  {isAdmin && viewingUserId && !isPreview && (
                                    <GradeButtons
                                      userId={viewingUserId}
                                      moduleId={mod.id}
                                      milestoneId={ms.id}
                                      currentGrade={currentGrade}
                                      onGraded={() => {}}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Hidden future weeks indicator */}
            {hiddenCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/20">
                <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <p className="text-xs text-muted-foreground/60">
                  {hiddenCount} more test-out{hiddenCount > 1 ? "s" : ""} will unlock as you progress through training.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
