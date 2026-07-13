import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  PlayCircle,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  ca: "Chiropractic Assistant",
  associate_doctor: "Associate Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

const TYPE_ICONS = {
  sop: BookOpen,
  video: Video,
  task: CheckCircle2,
  checklist: CheckCircle2,
};

const STATUS_COLORS = {
  completed: "bg-primary/15 text-primary",
  in_progress: "bg-amber-100 text-amber-700",
  not_started: "bg-secondary text-muted-foreground",
};

interface Props {
  trackId: number;
  trackName: string;
  onClose: () => void;
}

export default function TrackPreviewModal({ trackId, trackName, onClose }: Props) {
  const trackQuery = trpc.tracks.adminTrack.useQuery({ trackId });
  const track = trackQuery.data;

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (track) {
      // Expand first week by default
      if (track.milestones.length > 0) {
        setExpandedWeeks(new Set([track.milestones[0].id]));
      }
    }
  }, [track?.id]);

  const toggleWeek = (id: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalModules = track?.milestones.reduce((s, ms) => s + ms.modules.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trainee Preview</p>
            <h2 className="text-sm font-bold text-foreground">{trackName}</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
          Close Preview
        </button>
      </div>

      {/* Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 shrink-0">
        <p className="text-xs text-amber-700 font-medium">
          Preview mode — showing how this track appears to a trainee. Progress is simulated as "Not Started".
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Training Track</h1>
            </div>
            <Badge variant="secondary" className="text-xs">{trackName}</Badge>
          </div>

          {/* Progress Summary */}
          {track && (
            <Card className="mb-4">
              <CardContent className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{track.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">0 of {totalModules} modules complete</p>
                  </div>
                  <span className="text-2xl font-bold text-primary">0%</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "0%" }} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weeks */}
          {trackQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {track && (
            <div className="space-y-3">
              {track.milestones.map((ms, msIdx) => {
                const isExpanded = expandedWeeks.has(ms.id);
                // In trainee view: only current week (first) is unlocked, rest are locked
                const isCurrentWeek = msIdx === 0;
                const isNextWeek = msIdx === 1;

                return (
                  <div key={ms.id} className={`border rounded-xl overflow-hidden ${
                    isCurrentWeek ? "border-primary/40 bg-card" :
                    isNextWeek ? "border-border bg-card" :
                    "border-border bg-muted/20"
                  }`}>
                    {/* Week Header */}
                    <button
                      onClick={() => toggleWeek(ms.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{ms.title}</span>
                          {isCurrentWeek && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                              Current Week
                            </span>
                          )}
                          {isNextWeek && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                              Up Next
                            </span>
                          )}
                          {!isCurrentWeek && !isNextWeek && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                              Locked
                            </span>
                          )}
                        </div>
                        {ms.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ms.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{ms.modules.length} modules</span>
                    </button>

                    {/* Modules */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {ms.modules.map((mod) => {
                          const TypeIcon = TYPE_ICONS[mod.type as keyof typeof TYPE_ICONS] || BookOpen;
                          return (
                            <div
                              key={mod.id}
                              className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
                              onClick={() => window.open(`/modules/${mod.id}?trackId=${trackId}`, '_blank')}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground leading-snug">{mod.title}</p>
                                  {mod.description && (
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{mod.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                                      Not Started
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      mod.type === "video" ? "bg-blue-100 text-blue-700" :
                                      mod.type === "sop" ? "bg-purple-100 text-purple-700" :
                                      mod.type === "task" ? "bg-amber-100 text-amber-700" :
                                      "bg-green-100 text-green-700"
                                    }`}>
                                      {mod.type}
                                    </span>
                                    {mod.isRequired && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600">
                                        Required
                                      </span>
                                    )}
                                    {mod.quizEnabled && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">
                                        Quiz
                                      </span>
                                    )}
                                    {mod.loomUrl && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                                        <Video className="h-2.5 w-2.5" /> Video linked
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
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
          )}
        </div>
      </div>
    </div>
  );
}
