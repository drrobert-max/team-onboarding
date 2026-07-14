import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  GraduationCap,
  Lock,
  PlayCircle,
  RefreshCw,
  Search,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
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

export default function MyTrack() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  // All milestones start collapsed by default — user expands what they need
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<number> | null>(null); // null = not yet initialized

  const markComplete = trpc.progress.update.useMutation({
    onSuccess: () => {
      utils.tracks.myTrack.invalidate();
      toast.success("Module marked as complete!");
    },
    onError: () => toast.error("Failed to update progress."),
  });

  const trackQuery = trpc.tracks.myTrack.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
  });

  const track = trackQuery.data;

  // Once track loads, initialize all milestones as collapsed
  useEffect(() => {
    if (!track || collapsedMilestones !== null) return;
    const allIds = new Set(track.milestones.map(ms => ms.id));
    setCollapsedMilestones(allIds);
  }, [track, collapsedMilestones]);

  // Scroll to milestone anchor when navigated from Dashboard
  useEffect(() => {
    if (!track || collapsedMilestones === null) return;
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1);
    const milestoneId = parseInt(id.replace("milestone-", ""));
    if (!isNaN(milestoneId)) {
      setCollapsedMilestones(prev => {
        const next = new Set(prev ?? []);
        next.delete(milestoneId);
        return next;
      });
    }
    const el = document.getElementById(id);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [track, collapsedMilestones]);

  const toggleMilestone = (id: number) => {
    setCollapsedMilestones(prev => {
      const next = new Set(prev ?? []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter out test-out milestones
  const trainingMilestones = track?.milestones.filter(ms => !isTestOut(ms.title)) ?? [];

  // Calculate totals
  let totalModules = 0;
  let completedModules = 0;
  for (const ms of trainingMilestones) {
    totalModules += ms.modules.length;
    completedModules += ms.modules.filter(m => m.progress?.status === "completed").length;
  }
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // Search: flatten all modules across all milestones, filter by query
  const searchQuery = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    const results: Array<{ mod: any; milestoneTitle: string; milestoneId: number }> = [];
    for (const ms of trainingMilestones) {
      for (const mod of ms.modules) {
        const titleMatch = mod.title.toLowerCase().includes(searchQuery);
        const descMatch = mod.description?.toLowerCase().includes(searchQuery);
        if (titleMatch || descMatch) {
          results.push({ mod, milestoneTitle: ms.title, milestoneId: ms.id });
        }
      }
    }
    return results;
  }, [searchQuery, trainingMilestones]);

  const collapsed = collapsedMilestones ?? new Set<number>();

  // NOTE: keep all hooks above this early return — a return between hooks
  // changes the hook count across renders and crashes React (#310).
  if (!track && !trackQuery.isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="text-center py-20">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Training Track</h1>
          </div>
          {user?.teamRole && (
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[user.teamRole]}
            </Badge>
          )}
        </div>

        {/* Progress Summary */}
        {track && (
          <Card className="mb-4">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{track.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{completedModules} of {totalModules} modules complete</p>
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

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search modules across all weeks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="mb-6">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No modules found for "{search}"</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{search}"</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResults.map(({ mod, milestoneTitle }) => {
                    const status = mod.progress?.status ?? "not_started";
                    const statusCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.not_started;
                    const TypeIcon = TYPE_ICONS[mod.type as keyof typeof TYPE_ICONS] || BookOpen;
                    return (
                      <div
                        key={mod.id}
                        className="module-card text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 group"
                      >
                        <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{milestoneTitle}</p>
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
                              onClick={() => setLocation(`/modules/${mod.id}`)}
                              className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors text-left w-full"
                            >
                              {mod.title}
                            </button>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.className}`}>
                                {status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Not Started"}
                              </span>
                              {status !== "completed" ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markComplete.mutate({ moduleId: mod.id, status: "completed" });
                                  }}
                                  disabled={markComplete.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50"
                                >
                                  <Circle className="h-2.5 w-2.5" />
                                  Mark Complete
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markComplete.mutate({ moduleId: mod.id, status: "not_started" });
                                  }}
                                  disabled={markComplete.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          </div>
                          <ChevronRight
                            onClick={() => setLocation(`/modules/${mod.id}`)}
                            className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Milestones — hidden when search is active */}
        {searchResults === null && (
          trackQuery.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 bg-secondary rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {trainingMilestones.map((ms, msIdx) => {
                const msTotal = ms.modules.length;
                const msDone = ms.modules.filter(m => m.progress?.status === "completed").length;
                const isLocked = msIdx > 0 && trainingMilestones[msIdx - 1].modules.filter(m => m.progress?.status !== "completed").length > 0;
                const isCollapsed = collapsed.has(ms.id);

                return (
                  <div key={ms.id} id={`milestone-${ms.id}`} className="scroll-mt-4 border border-border rounded-xl overflow-hidden">
                    {/* Milestone Header */}
                    <button
                      onClick={() => toggleMilestone(ms.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/40 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msDone === msTotal && msTotal > 0 ? "bg-primary/15" : isLocked ? "bg-secondary" : "bg-primary/10"
                      }`}>
                        {msDone === msTotal && msTotal > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : isLocked ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <span className="text-xs font-bold text-primary">W{ms.weekNumber}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-foreground">{ms.title}</h2>
                        <p className="text-xs text-muted-foreground">{ms.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mr-2">{msDone}/{msTotal}</span>
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
                      )}
                    </button>

                    {/* Modules Grid */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pt-3 bg-card/50">
                        {ms.modules.map((mod) => {
                          const status = mod.progress?.status ?? "not_started";
                          const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
                          const TypeIcon = TYPE_ICONS[mod.type as keyof typeof TYPE_ICONS] || BookOpen;

                          return (
                            <div
                              key={mod.id}
                              className="module-card text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 group"
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
                                    onClick={() => setLocation(`/modules/${mod.id}`)}
                                    className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors text-left w-full"
                                  >
                                    {mod.title}
                                  </button>
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.className}`}>
                                      {status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Not Started"}
                                    </span>
                                    {status !== "completed" ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markComplete.mutate({ moduleId: mod.id, status: "completed" });
                                        }}
                                        disabled={markComplete.isPending}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50"
                                      >
                                        <Circle className="h-2.5 w-2.5" />
                                        Mark Complete
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markComplete.mutate({ moduleId: mod.id, status: "not_started" });
                                        }}
                                        disabled={markComplete.isPending}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                      >
                                        Undo
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight
                                  onClick={() => setLocation(`/modules/${mod.id}`)}
                                  className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors cursor-pointer"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}
