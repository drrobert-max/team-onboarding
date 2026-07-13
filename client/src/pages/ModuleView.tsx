import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Headphones,
  Loader2,
  MessageCircle,
  Monitor,
  PlayCircle,
  RefreshCw,
  Trophy,
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Streamdown } from "streamdown";

function SopContent({ content }: { content: string }) {
  const isHtml = content.trimStart().startsWith('<');
  if (isHtml) {
    return <div className="sop-rich-content" dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <Streamdown>{content}</Streamdown>
    </div>
  );
}
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { HighlightableScript } from "@/components/HighlightableScript";

// ─── Software IDs for "Establish Access to Company Software" ─────────────────
const SOFTWARE_MODULE_IDS = [172, 179, 286, 293, 120006, 120009];
// ─── CA Onboarding Program Team Members modules (Circle login button) ─────────
const CIRCLE_MODULE_IDS = [170, 30037, 30011, 256, 269, 271, 284, 30055, 30029, 370, 383, 385];
// ─── Script practice module IDs ──────────────────────────────────────────────
const SCRIPT_MODULE_IDS = [
  174, 288, 60008, // Start Memorizing Day 1 Education
  189, 303,        // Practice Day 1 Education with Team Member
  215, 329,        // Practicing Phone Script
  30002, 30020,    // Watch Office Tour & Memorize Script
  30018, 30036,    // Memorize Day 2 Greeting and Care Plan Setup
  30042, 30060,    // Week 5: Practice Day 1 Education (CA & Scan Tech)
  30007, 30008, 30025, 30026, // Week 6: Practice Day One Flow & Practice Day 1 Education (CA & Scan Tech)
];

// ─── Software Checklist Card ─────────────────────────────────────────────────
function SoftwareChecklistCard({
  moduleId,
  userId,
  onAllChecked,
  title = "Software Access Checklist",
  subtitle = "Check off each software once access has been granted. All items must be checked to complete this module.",
}: {
  moduleId: number;
  userId: number;
  onAllChecked: () => void;
  title?: string;
  subtitle?: string;
}) {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.softwareChecklist.getItems.useQuery(
    { userId, moduleId },
    { enabled: userId > 0 && moduleId > 0 }
  );

  const toggleItem = trpc.softwareChecklist.toggleItem.useMutation({
    onSuccess: (result) => {
      utils.softwareChecklist.getItems.invalidate({ userId, moduleId });
      if (result.allChecked) {
        onAllChecked();
      }
    },
    onError: () => toast.error("Failed to update checklist."),
  });

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const checkedCount = items?.filter((i) => i.isChecked).length ?? 0;
  const totalCount = items?.length ?? 0;
  const allDone = checkedCount === totalCount && totalCount > 0;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Badge
            variant={allDone ? "default" : "secondary"}
            className={allDone ? "bg-emerald-600 text-white" : ""}
          >
            {checkedCount}/{totalCount}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {subtitle}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items?.map((item) => (
            <button
              key={item.softwareName}
              onClick={() =>
                toggleItem.mutate({ userId, moduleId, softwareName: item.softwareName })
              }
              disabled={toggleItem.isPending}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all text-left ${
                item.isChecked
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border hover:border-primary/40 hover:bg-secondary"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  item.isChecked
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-muted-foreground/40"
                }`}
              >
                {item.isChecked && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                )}
              </div>
              <span className={`font-medium ${item.isChecked ? "line-through opacity-70" : ""}`}>
                {item.softwareName}
              </span>
              {item.isChecked && item.checkedAt && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(item.checkedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
        {allDone && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              All software access granted — module complete!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Audio player — uses /manus-storage/ proxy which streams bytes with Range support.
// Enforces single-player: pauses all other <audio> elements on the page when this one starts.
function AudioPlayer({ label, storagePath }: { label: string; storagePath: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Extract the storage key from the /manus-storage/{key} path
  const storageKey = storagePath.replace(/^\/manus-storage\//, '');
  const presignQuery = trpc.storage.presign.useQuery(
    { key: storageKey },
    { enabled: !!storageKey, staleTime: 4 * 60 * 1000 } // refresh before 5-min expiry
  );

  const handlePlay = () => {
    // Pause every other audio element currently playing on the page
    document.querySelectorAll<HTMLAudioElement>('audio').forEach((el) => {
      if (el !== audioRef.current && !el.paused) {
        el.pause();
      }
    });
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      {presignQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audio...
        </div>
      )}
      {presignQuery.data?.url && (
        <audio
          ref={audioRef}
          controls
          className="w-full"
          src={presignQuery.data.url}
          preload="metadata"
          onPlay={handlePlay}
        >
          Your browser does not support the audio element.
        </audio>
      )}
      {presignQuery.isError && (
        <p className="text-sm text-destructive">Failed to load audio. Please refresh.</p>
      )}
    </div>
  );
}

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const moduleId = parseInt(id ?? "0");
  const [location, setLocation] = useLocation();
  // useSearch() is reactive — updates correctly on client-side navigation
  // Fall back to window.location.search for initial load in new tabs (wouter may not capture it)
  const searchString = useSearch() || window.location.search;
  const trackIdParam = new URLSearchParams(searchString).get('trackId');
  const previewTrackId = trackIdParam ? parseInt(trackIdParam) : undefined;
  const { user } = useAuth();

  const moduleQuery = trpc.tracks.moduleById.useQuery(
    { id: moduleId },
    { enabled: moduleId > 0 }
  );
  const generateQuiz = trpc.quiz.generate.useMutation({
    onSuccess: () => moduleQuery.refetch(),
    onError: () => toast.error("Failed to generate quiz. Please try again."),
  });
  const submitQuiz = trpc.quiz.submit.useMutation({
    onSuccess: (result) => {
      setQuizResult(result);
      moduleQuery.refetch();
    },
    onError: () => toast.error("Failed to submit quiz. Please try again."),
  });
  const markStarted = trpc.progress.update.useMutation();
  const utils = trpc.useUtils();
  const markComplete = trpc.progress.update.useMutation({
    onSuccess: () => {
      moduleQuery.refetch();
      utils.tracks.myTrack.invalidate();
      toast.success("Module complete! 🎉", {
        description: "Great work — keep it up!",
        duration: 3000,
      });
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#4ade80", "#22c55e", "#16a34a", "#bbf7d0", "#facc15", "#ffffff"],
        scalar: 1.0,
        gravity: 1.1,
      });
    },
    onError: () => toast.error("Failed to update progress."),
  });
  const markUndo = trpc.progress.update.useMutation({
    onSuccess: () => {
      moduleQuery.refetch();
      utils.tracks.myTrack.invalidate();
      toast.success("Marked as incomplete.");
    },
    onError: () => toast.error("Failed to update progress."),
  });

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);

  // Task item checkboxes
  const taskItemsQuery = trpc.moduleTaskItems.getItems.useQuery(
    { moduleId },
    { enabled: moduleId > 0 }
  );
  const toggleTaskItem = trpc.moduleTaskItems.toggleItem.useMutation({
    onSuccess: () => taskItemsQuery.refetch(),
  });

  const moduleSopsQuery = trpc.tracks.getModuleSops.useQuery(
    { moduleId },
    { enabled: moduleId > 0 }
  );
  const linkedSops = moduleSopsQuery.data ?? [];

  const adjacentQuery = trpc.tracks.adjacentModules.useQuery(
    { moduleId, ...(previewTrackId ? { trackId: previewTrackId } : {}) },
    { enabled: moduleId > 0 && !!user, retry: 2 }
  );
  const adjacent = adjacentQuery.data;

  const mod = moduleQuery.data;
  const quiz = mod?.quiz as any;
  const progress = mod?.progress;
  const attempts = mod?.attempts ?? [];
  const bestAttempt = attempts.reduce((best: any, a: any) => (!best || a.score > best.score ? a : best), null);

  // Parse bullet lines from description for interactive checklist
  const bulletLines = (mod?.description ?? "")
    .split("\n")
    .filter((line: string) => /^[-•·]\s/.test(line) || /^\s{2,}[-•·]\s/.test(line))
    .map((line: string) => line.replace(/^\s*[-•·]\s/, "").trim())
    .filter(Boolean);
  const hasBulletChecklist = bulletLines.length > 0;
  const savedItems = taskItemsQuery.data ?? [];
  const checkedMap: Record<number, boolean> = {};
  savedItems.forEach((item: any) => { checkedMap[item.itemIndex] = item.isChecked; });
  const allBulletsChecked = hasBulletChecklist ? bulletLines.every((_: string, i: number) => checkedMap[i] === true) : true;

  // Mark as in-progress when opened (only once, in effect)
  useEffect(() => {
    if (mod && (!progress || progress.status === "not_started")) {
      markStarted.mutate({ moduleId, status: "in_progress" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod?.id]);

  const isSoftwareModule = SOFTWARE_MODULE_IDS.includes(moduleId);

  // Handler: when all software items are checked, auto-complete the module
  const handleAllSoftwareChecked = () => {
    if (progress?.status !== "completed") {
      markComplete.mutate({ moduleId, status: "completed" });
    }
  };

  if (moduleQuery.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!mod) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Module not found.</p>
          <Button variant="ghost" onClick={() => setLocation("/my-track")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Track
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleGenerateQuiz = () => {
    generateQuiz.mutate({ moduleId });
  };

  const handleSubmitQuiz = () => {
    if (!quiz) return;
    const questions = quiz.questions as any[];
    if (Object.keys(quizAnswers).length < questions.length) {
      toast.error("Please answer all questions before submitting.");
      return;
    }
    const answersArray = questions.map((_: any, i: number) => quizAnswers[i] ?? -1);
    submitQuiz.mutate({ moduleId, quizId: quiz.id, answers: answersArray });
  };

  const isCompleted = progress?.status === "completed";

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Navigation Row */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/my-track")} className="gap-1.5 -ml-2 text-xs sm:text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Track</span>
            <span className="sm:hidden">Track</span>
          </Button>
          {/* Week label + lesson position — shown for all users */}
          {adjacent?.weekLabel && (
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-xs font-semibold text-primary">{adjacent.weekLabel}</span>
              {adjacent.currentIndex != null && adjacent.totalCount != null && (
                <span className="text-xs text-muted-foreground">Lesson {adjacent.currentIndex} of {adjacent.totalCount}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={adjacentQuery.isLoading || !adjacent?.prev}
              onClick={() => adjacent?.prev && setLocation(`/modules/${adjacent.prev.id}${previewTrackId ? `?trackId=${previewTrackId}` : ``}`)}
              className="gap-1 px-2 sm:px-3"
            >
              {adjacentQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />}
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={adjacentQuery.isLoading || !adjacent?.next}
              onClick={() => adjacent?.next && setLocation(`/modules/${adjacent.next.id}${previewTrackId ? `?trackId=${previewTrackId}` : ``}`)}
              className="gap-1 px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Next</span>
              {adjacentQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Module Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isCompleted ? "bg-primary/10" : "bg-primary/20"
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : isSoftwareModule ? (
                <Monitor className="h-6 w-6 text-primary" />
              ) : mod.type === "video" ? (
                <Video className="h-6 w-6 text-primary" />
              ) : (
                <BookOpen className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{mod.title}</h1>
              <div className="text-muted-foreground mt-2 text-sm space-y-1">
                {mod.description?.split("\n").map((line, i) => {
                  const isBullet = /^[-•·]\s/.test(line) || /^\s{2,}[-•·]\s/.test(line);
                  const isIndented = /^\s{2,}/.test(line) && !isBullet;
                  const urlRegex = /(https?:\/\/[^\s]+)/g;
                  const parts = line.split(urlRegex).map((part, j) =>
                    urlRegex.test(part)
                      ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">{part}</a>
                      : part
                  );
                  if (isBullet) {
                    // Render as interactive checkbox instead of bullet
                    const text = line.replace(/^\s*[-•·]\s/, "").trim();
                    const bulletIndex = bulletLines.indexOf(text);
                    const isChecked = checkedMap[bulletIndex] === true;
                    return (
                      <label
                        key={i}
                        className={`flex items-start gap-2.5 ml-1 py-1 cursor-pointer group ${
                          isChecked ? "opacity-60" : ""
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={toggleTaskItem.isPending}
                          onCheckedChange={(checked) => {
                            if (bulletIndex >= 0) {
                              toggleTaskItem.mutate({
                                moduleId,
                                itemIndex: bulletIndex,
                                itemText: text,
                                isChecked: checked === true,
                              });
                            }
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <span className={isChecked ? "line-through text-muted-foreground/60" : ""}>{text}</span>
                      </label>
                    );
                  }
                  if (line.trim() === "") return <div key={i} className="h-1" />;
                  return <div key={i} className={isIndented ? "ml-4" : ""}>{parts}</div>;
                })}
                {hasBulletChecklist && !allBulletsChecked && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 ml-1">
                    ⚠️ Check off all items above to mark this module complete.
                  </p>
                )}
                {hasBulletChecklist && allBulletsChecked && !isCompleted && (
                  <p className="text-xs text-primary mt-2 ml-1">
                    ✓ All items checked — you can now mark this module complete.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary" className="text-xs capitalize">{mod.type}</Badge>
                {isCompleted && <Badge className="badge-completed text-xs">Completed</Badge>}
                {progress?.status === "in_progress" && <Badge className="badge-in-progress text-xs">In Progress</Badge>}
              </div>
            </div>
          </div>
        </div>

        {/* Software Access Checklist — shown only for the Establish Access module */}
        {isSoftwareModule && user && (
          <SoftwareChecklistCard
            moduleId={moduleId}
            userId={user.id}
            onAllChecked={handleAllSoftwareChecked}
          />
        )}

        {/* Loom Video */}
        {mod.loomUrl && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                Training Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={`https://www.loom.com/embed/${mod.loomVideoId || mod.loomUrl.split("/").pop()}`}
                  frameBorder="0"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full rounded-lg"
                />
              </div>
              {!isCompleted && (
                <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <Checkbox
                    id="video-watched"
                    checked={videoWatched}
                    onCheckedChange={(v) => setVideoWatched(!!v)}
                  />
                  <label htmlFor="video-watched" className="text-sm text-foreground cursor-pointer select-none">
                    I have watched this video
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Audio Files */}
        {mod.audioFiles && (mod.audioFiles as any[]).length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary" />
                Phone Consult Recordings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(mod.audioFiles as { label: string; url: string }[]).map((af, i) => (
                  <AudioPlayer key={i} label={af.label} storagePath={af.url} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SOP Content */}
        {mod.sop && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {mod.sop.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">v{mod.sop.version}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(mod.sop.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SopContent content={mod.sop.content} />
            </CardContent>
          </Card>
        )}

        {/* Circle Login Button — shown on CA Onboarding Program Team Members modules */}
        {CIRCLE_MODULE_IDS.includes(moduleId) && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-foreground">CA Onboarding Program</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Log in to Circle to access your team members video</p>
                </div>
                <a href="https://login.circle.so/sign_in" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white shrink-0">
                    <ExternalLink className="h-4 w-4" />
                    Log in to Circle
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Instructions */}
        {mod.taskInstructions && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              {SCRIPT_MODULE_IDS.includes(moduleId) ? (
                <HighlightableScript
                  moduleId={moduleId}
                  userId={user?.id ?? 0}
                  content={mod.taskInstructions}
                />
              ) : (
                <div className="prose prose-sm max-w-none text-foreground">
                  <Streamdown>{mod.taskInstructions}</Streamdown>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quiz Section — only shown when quizEnabled is true on this module */}
        {mod?.quizEnabled && <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Comprehension Quiz
              </CardTitle>
              {bestAttempt && (
                <Badge className={bestAttempt.passed ? "badge-completed" : "badge-overdue"}>
                  Best: {bestAttempt.score}%
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Quiz Result */}
            {quizResult && (
              <div className={`rounded-xl p-5 mb-5 ${quizResult.passed ? "bg-primary/5 border border-primary/30" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center gap-3 mb-2">
                  {quizResult.passed ? (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <p className={`font-semibold ${quizResult.passed ? "text-primary" : "text-red-800"}`}>
                      {quizResult.passed ? "Quiz Passed!" : "Not Passed"}
                    </p>
                    <p className={`text-sm ${quizResult.passed ? "text-primary" : "text-red-700"}`}>
                      {quizResult.correct} of {quizResult.total} correct · {quizResult.score}%
                    </p>
                  </div>
                </div>
                {!quizResult.passed && (
                  <p className="text-xs text-red-700 mt-2">Review the material above and try again. Passing score is 75%.</p>
                )}
              </div>
            )}

            {/* No quiz yet */}
            {!quiz && !quizResult && (
              <div className="text-center py-6">
                <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Complete the reading above, then take a short quiz to verify your understanding.
                </p>
                <Button
                  onClick={handleGenerateQuiz}
                  disabled={generateQuiz.isPending}
                  className="gap-2"
                >
                  {generateQuiz.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Quiz...</>
                  ) : (
                    <><PlayCircle className="h-4 w-4" /> Generate Quiz</>
                  )}
                </Button>
              </div>
            )}

            {/* Quiz Questions */}
            {quiz && !quizResult && showQuiz && (
              <div className="space-y-6">
                {(quiz.questions as any[]).map((q: any, qi: number) => (
                  <div key={q.id}>
                    <p className="text-sm font-semibold text-foreground mb-3">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt: string, oi: number) => (
                        <button
                          key={oi}
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                            quizAnswers[qi] === oi
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border hover:border-primary/40 hover:bg-secondary"
                          }`}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={submitQuiz.isPending || Object.keys(quizAnswers).length < (quiz.questions as any[]).length}
                    className="gap-2"
                  >
                    {submitQuiz.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <>Submit Quiz <ChevronRight className="h-4 w-4" /></>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowQuiz(false); setQuizAnswers({}); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Quiz available but not started */}
            {quiz && !quizResult && !showQuiz && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{(quiz.questions as any[]).length} questions · {quiz.passingScore}% to pass</p>
                  {attempts.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{attempts.length} attempt{attempts.length !== 1 ? "s" : ""} taken</p>
                  )}
                </div>
                <Button onClick={() => { setShowQuiz(true); setQuizAnswers({}); }} className="gap-2">
                  {attempts.length > 0 ? (
                    <><RefreshCw className="h-4 w-4" /> Retake Quiz</>
                  ) : (
                    <><PlayCircle className="h-4 w-4" /> Start Quiz</>
                  )}
                </Button>
              </div>
            )}

            {/* Already passed */}
            {isCompleted && !quizResult && (
              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/30">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">Module Complete</p>
                  <p className="text-xs text-primary">
                    You passed this quiz{bestAttempt ? ` with ${bestAttempt.score}%` : ""}. This module is marked complete.
                  </p>
                </div>
                {quiz && (
                  <Button variant="outline" size="sm" onClick={() => { setShowQuiz(true); setQuizAnswers({}); }} className="ml-auto shrink-0 gap-1">
                    <RefreshCw className="h-3 w-3" /> Retake
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Related SOPs */}
        {linkedSops.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Related SOPs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {linkedSops.map((sop) => (
                  <li key={sop.id}>
                    <button
                      onClick={() => setLocation(`/sops/${sop.id}?from=${moduleId}${previewTrackId ? `&trackId=${previewTrackId}` : ``}`)}
                      className="flex items-center gap-2 text-sm text-primary hover:underline hover:text-primary/80 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      {sop.title}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Ask a Question + Submit Script Video buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => setLocation(`/submissions?tab=questions&module=${encodeURIComponent(mod.title)}&from=${moduleId}${previewTrackId ? `&trackId=${previewTrackId}` : ``}`)}
          >
            <MessageCircle className="h-4 w-4" />
            Ask a Question
          </Button>
          {SCRIPT_MODULE_IDS.includes(moduleId) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
              onClick={() => setLocation(`/submissions?tab=videos&module=${encodeURIComponent(mod.title)}&from=${moduleId}${previewTrackId ? `&trackId=${previewTrackId}` : ``}`)}
            >
              <Upload className="h-4 w-4" />
              Submit Script Video
            </Button>
          )}
        </div>

        {/* Mark Complete / Undo — shown for non-quiz, non-software modules */}
        {!mod.quizEnabled && !isSoftwareModule && (
          <div className="mt-6 flex justify-center">
            {isCompleted ? (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
                disabled={markUndo.isPending}
                onClick={() => markUndo.mutate({ moduleId, status: "in_progress" })}
              >
                {markUndo.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Completed — Undo
              </Button>
            ) : (
              <Button
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-white"
                disabled={markComplete.isPending || !allBulletsChecked || (!!mod.loomUrl && !videoWatched && !isCompleted)}
                title={!allBulletsChecked ? "Check off all required items above first" : undefined}
                onClick={() => markComplete.mutate({ moduleId, status: "completed" })}
              >
                {markComplete.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark as Complete
              </Button>
            )}
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            disabled={adjacentQuery.isLoading || !adjacent?.prev}
            onClick={() => adjacent?.prev && setLocation(`/modules/${adjacent.prev.id}${previewTrackId ? `?trackId=${previewTrackId}` : ``}`)}
            className="gap-2"
          >
            {adjacentQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />}
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Previous</p>
              <p className="text-sm font-medium leading-snug line-clamp-1 max-w-[160px]">
                {adjacentQuery.isLoading ? "Loading..." : (adjacent?.prev?.title ?? "—")}
              </p>
            </div>
          </Button>
          <Button
            variant="outline"
            disabled={adjacentQuery.isLoading || !adjacent?.next}
            onClick={() => adjacent?.next && setLocation(`/modules/${adjacent.next.id}${previewTrackId ? `?trackId=${previewTrackId}` : ``}`)}
            className="gap-2"
          >
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Next</p>
              <p className="text-sm font-medium leading-snug line-clamp-1 max-w-[160px]">
                {adjacentQuery.isLoading ? "Loading..." : (adjacent?.next?.title ?? "—")}
              </p>
            </div>
            {adjacentQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
