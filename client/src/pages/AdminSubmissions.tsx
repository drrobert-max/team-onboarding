import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { etDate, etDateTime } from "@/lib/utils";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageCircle, Video, Mic, MicOff, Square, Send } from "lucide-react";
import { useSearch } from "wouter";

// ─── Thread Bubble ────────────────────────────────────────────────────────────
function ThreadBubble({ msg }: { msg: { message: string; userName: string | null; userRole: string | null; createdAt: Date | string } }) {
  const isAdmin = msg.userRole === "admin";
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        <p className={`text-[11px] font-semibold mb-1 ${isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {msg.userName ?? (isAdmin ? "Leadership" : "Trainee")}
        </p>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
        <p className={`text-[10px] mt-1 ${isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {etDateTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Voice Recorder ───────────────────────────────────────────────────────────
function VoiceRecorder({ onRecorded }: { onRecorded: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setRecorded(blob); setAudioUrl(URL.createObjectURL(blob)); onRecorded(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mr.start(); setRecording(true);
  }

  function stopRecording() { mediaRef.current?.stop(); setRecording(false); }
  function clearRecording() { setRecorded(null); setAudioUrl(null); }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Voice Note (optional)</p>
      {!recorded ? (
        <Button type="button" variant="outline" size="sm" onClick={recording ? stopRecording : startRecording} className={recording ? "border-red-500 text-red-500 hover:bg-red-50" : ""}>
          {recording ? <><Square className="w-3 h-3 mr-1" /> Stop Recording</> : <><Mic className="w-3 h-3 mr-1" /> Record Voice Note</>}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <audio src={audioUrl!} controls className="flex-1 h-8" />
          <Button type="button" variant="ghost" size="sm" onClick={clearRecording}><MicOff className="w-3 h-3" /></Button>
        </div>
      )}
    </div>
  );
}

// ─── Question Row ─────────────────────────────────────────────────────────────
function QuestionRow({ q, defaultOpen, onReply }: { q: any; defaultOpen?: boolean; onReply: () => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [replyText, setReplyText] = useState("");
  // Auto-open when deepLink data arrives after async loadd
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      setTimeout(() => {
        const el = document.getElementById(`question-${q.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [defaultOpen, q.id]);

  const { data: replies = [], isLoading: rLoading } = trpc.submissions.getQuestionReplies.useQuery(
    { questionId: q.id },
    { enabled: open }
  );

  const addReply = trpc.submissions.addQuestionReply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.submissions.getQuestionReplies.invalidate({ questionId: q.id });
      onReply();
    },
    onError: () => toast.error("Failed to send reply."),
  });

  const markAnswered = trpc.submissions.markQuestionAnswered.useMutation({
    onSuccess: () => { toast.success("Marked as answered."); onReply(); },
    onError: () => toast.error("Failed to update status."),
  });

  const markOpen = trpc.submissions.markQuestionOpen.useMutation({
    onSuccess: () => { toast.success("Reopened."); onReply(); },
    onError: () => toast.error("Failed to update status."),
  });

  return (
    <Card className="border border-border" id={`question-${q.id}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">{q.userName ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{q.userEmail}</span>
            </div>
            <p className="text-sm text-foreground line-clamp-2">{q.question}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{etDate(q.createdAt)}</span>
              {q.moduleName && (
                <a
                  href={q.resolvedModuleId ? `/modules/${q.resolvedModuleId}` : undefined}
                  onClick={q.resolvedModuleId ? (e) => e.stopPropagation() : undefined}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium ${q.resolvedModuleId ? 'hover:bg-primary/20 transition-colors cursor-pointer' : ''}`}
                >
                  📚 {q.moduleName}
                </a>
              )}
            </div>
          </div>
          <Badge variant={q.status === "answered" ? "default" : "secondary"} className={q.status === "answered" ? "bg-green-600 text-white shrink-0" : "shrink-0"}>
            {q.status === "answered" ? "Answered" : "Open"}
          </Badge>
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {/* Original question */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground">
                <p className="text-[11px] font-semibold mb-1 text-muted-foreground">{q.userName ?? "Trainee"} (original question)</p>
                <p className="whitespace-pre-wrap leading-relaxed">{q.question}</p>
                <p className="text-[10px] mt-1 text-muted-foreground">{etDateTime(q.createdAt)}</p>
              </div>
            </div>

            {/* Thread */}
            {rLoading ? <p className="text-xs text-muted-foreground text-center py-2">Loading thread...</p>
              : replies.map((r: any) => <ThreadBubble key={r.id} msg={r} />)}

            {/* Reply box */}
            <div className="flex gap-2 pt-1">
              <Textarea
                placeholder="Reply to trainee..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim()) addReply.mutate({ questionId: q.id, message: replyText.trim() });
                  }
                }}
              />
              <Button size="sm" className="self-end" disabled={!replyText.trim() || addReply.isPending}
                onClick={() => { if (replyText.trim()) addReply.mutate({ questionId: q.id, message: replyText.trim() }); }}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {/* Status toggle */}
            <div className="flex justify-end pt-1">
              {q.status !== "answered" ? (
                <Button size="sm" variant="outline" className="text-green-700 border-green-600 hover:bg-green-50 text-xs"
                  disabled={markAnswered.isPending}
                  onClick={() => markAnswered.mutate({ questionId: q.id })}>
                  ✓ Mark Answered
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-amber-700 border-amber-500 hover:bg-amber-50 text-xs"
                  disabled={markOpen.isPending}
                  onClick={() => markOpen.mutate({ questionId: q.id })}>
                  ↩ Reopen
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// ─── Video Submission Roww ─────────────────────────────────────────────────────
function VideoRow({ v, defaultOpen, onReview }: { v: any; defaultOpen?: boolean; onReview: () => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [feedback, setFeedback] = useState(v.feedback ?? "");
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-open when deepLink data arrives after async load
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      setTimeout(() => {
        const el = document.getElementById(`video-${v.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [defaultOpen, v.id]);

  const presign = trpc.storage.presign.useQuery({ key: v.fileKey }, { enabled: open && !!v.fileKey });
  const voicePresign = trpc.storage.presign.useQuery({ key: v.voiceFeedbackKey ?? "" }, { enabled: open && !!v.voiceFeedbackKey });
  const presignUpload = trpc.storage.presignUpload.useMutation();

  const { data: replies = [], isLoading: rLoading } = trpc.submissions.getVideoReplies.useQuery(
    { videoSubmissionId: v.id },
    { enabled: open }
  );

  const reviewMutation = trpc.submissions.reviewVideo.useMutation({
    onSuccess: () => { toast.success("Feedback submitted."); onReview(); },
    onError: () => toast.error("Failed to submit feedback."),
  });

  const addReply = trpc.submissions.addVideoReply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.submissions.getVideoReplies.invalidate({ videoSubmissionId: v.id });
    },
    onError: () => toast.error("Failed to send reply."),
  });

  async function handleSubmitFeedback() {
    setUploading(true);
    try {
      let voiceKey: string | undefined, voiceUrl: string | undefined;
      if (voiceBlob) {
        const key = `submissions/voice/${Date.now()}.webm`;
        const { url: uploadUrl, key: finalKey, storageUrl } = await presignUpload.mutateAsync({ key });
        const resp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "audio/webm" }, body: voiceBlob });
        if (!resp.ok) throw new Error("Voice upload failed");
        voiceKey = finalKey; voiceUrl = storageUrl;
      }
      await reviewMutation.mutateAsync({ submissionId: v.id, feedback: feedback.trim() || undefined, voiceFeedbackKey: voiceKey, voiceFeedbackUrl: voiceUrl });
    } catch { toast.error("Failed to submit feedback."); }
    finally { setUploading(false); }
  }

  return (
    <Card className="border border-border" id={`video-${v.id}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">{v.userName ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{v.userEmail}</span>
            </div>
            <p className="text-sm text-foreground">{v.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{etDate(v.createdAt)} · {v.fileName}</span>
              {v.moduleName && (
                <a
                  href={v.resolvedModuleId ? `/modules/${v.resolvedModuleId}` : undefined}
                  onClick={v.resolvedModuleId ? (e) => e.stopPropagation() : undefined}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium ${v.resolvedModuleId ? 'hover:bg-primary/20 transition-colors cursor-pointer' : ''}`}
                >
                  📚 {v.moduleName}
                </a>
              )}
            </div>
          </div>
          <Badge variant={v.status === "reviewed" ? "default" : "secondary"} className={v.status === "reviewed" ? "bg-green-600 text-white shrink-0" : "shrink-0"}>
            {v.status === "reviewed" ? "Reviewed" : "Pending"}
          </Badge>
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-border space-y-4">
            {presign.data?.url && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Submitted Video</p>
                <video src={presign.data.url} controls className="w-full max-h-72 rounded-md bg-black" />
              </div>
            )}

            {/* Existing feedback */}
            {v.feedback && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-primary text-primary-foreground">
                  <p className="text-[11px] font-semibold mb-1 text-primary-foreground/70">Your Previous Feedback</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{v.feedback}</p>
                </div>
              </div>
            )}
            {v.voiceFeedbackKey && voicePresign.data?.url && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Previous Voice Feedback</p>
                <audio src={voicePresign.data.url} controls className="w-full" />
              </div>
            )}

            {/* Thread replies */}
            {rLoading ? <p className="text-xs text-muted-foreground text-center py-2">Loading thread...</p>
              : replies.map((r: any) => <ThreadBubble key={r.id} msg={r} />)}

            {/* Initial feedback form (if not yet reviewed) */}
            {v.status !== "reviewed" && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground">Submit Initial Feedback</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Written Feedback (optional)</p>
                  <Textarea placeholder="Leave written feedback..." value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} className="resize-none" />
                </div>
                <VoiceRecorder onRecorded={blob => setVoiceBlob(blob)} />
                <div className="flex justify-end">
                  <Button size="sm" disabled={(!feedback.trim() && !voiceBlob) || uploading || reviewMutation.isPending} onClick={handleSubmitFeedback}>
                    {uploading || reviewMutation.isPending ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </div>
              </div>
            )}

            {/* Reply box (always available after reviewed) */}
            {v.status === "reviewed" && (
              <div className="flex gap-2 pt-1">
                <Textarea
                  placeholder="Reply to trainee..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim()) addReply.mutate({ videoSubmissionId: v.id, message: replyText.trim() });
                    }
                  }}
                />
                <Button size="sm" className="self-end" disabled={!replyText.trim() || addReply.isPending}
                  onClick={() => { if (replyText.trim()) addReply.mutate({ videoSubmissionId: v.id, message: replyText.trim() }); }}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminSubmissions() {
  const utils = trpc.useUtils();

  const searchString = useSearch() || window.location.search;
  const urlParams = new URLSearchParams(searchString);
  const urlTab = urlParams.get("tab") ?? "questions";
  const deepLinkId = urlParams.get("id") ? Number(urlParams.get("id")) : null;

  const [activeTab, setActiveTab] = useState(urlTab === "videos" ? "videos" : "questions");
  const [showAnswered, setShowAnswered] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);

  const { data: questions = [], isLoading: qLoading } = trpc.submissions.allQuestions.useQuery({ limit: 200, offset: 0 });
  const { data: videos = [], isLoading: vLoading } = trpc.submissions.allVideos.useQuery({ limit: 200, offset: 0 });

  const openQuestions = questions.filter((q: any) => q.status === "open");
  const answeredQuestions = questions.filter((q: any) => q.status === "answered");
  const pendingVideos = videos.filter((v: any) => v.status === "pending");
  const reviewedVideos = videos.filter((v: any) => v.status === "reviewed");

  // Scroll to deep-linked item after data loads
  useEffect(() => {
    if (!deepLinkId) return;
    const type = activeTab === "videos" ? "video" : "question";
    const el = document.getElementById(`${type}-${deepLinkId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [deepLinkId, activeTab, questions.length, videos.length]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submissions Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">Review trainee questions and script video submissions.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open Questions", value: openQuestions.length, color: "text-amber-600", action: () => { setActiveTab("questions"); setShowAnswered(false); } },
            { label: "Answered", value: answeredQuestions.length, color: "text-green-600", action: () => { setActiveTab("questions"); setShowAnswered(true); setTimeout(() => document.getElementById('answered-archive')?.scrollIntoView({ behavior: 'smooth' }), 100); } },
            { label: "Pending Videos", value: pendingVideos.length, color: "text-amber-600", action: () => { setActiveTab("videos"); setShowReviewed(false); } },
            { label: "Reviewed", value: reviewedVideos.length, color: "text-green-600", action: () => { setActiveTab("videos"); setShowReviewed(true); setTimeout(() => document.getElementById('reviewed-archive')?.scrollIntoView({ behavior: 'smooth' }), 100); } },
          ].map(s => (
            <Card key={s.label} className="text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={s.action}>
              <CardContent className="pt-4 pb-3">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="questions" className="flex-1 gap-2">
              <MessageCircle className="w-4 h-4" /> Questions
              {openQuestions.length > 0 && <Badge className="bg-amber-500 text-white text-xs ml-1">{openQuestions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-1 gap-2">
              <Video className="w-4 h-4" /> Script Videos
              {pendingVideos.length > 0 && <Badge className="bg-amber-500 text-white text-xs ml-1">{pendingVideos.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-3 mt-4">
            {/* Answered archive toggle */}
            {answeredQuestions.length > 0 && (
              <button
                id="answered-archive"
                onClick={() => setShowAnswered(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-sm"
              >
                <span className="font-medium text-muted-foreground">
                  {showAnswered ? "▾" : "▸"} Answered ({answeredQuestions.length})
                </span>
                <span className="text-xs text-muted-foreground">{showAnswered ? "Hide" : "View"}</span>
              </button>
            )}
            {showAnswered && answeredQuestions.map((q: any) => (
              <QuestionRow key={q.id} q={q} defaultOpen={deepLinkId === q.id} onReply={() => utils.submissions.allQuestions.invalidate()} />
            ))}
            {/* Open questions */}
            {openQuestions.length > 0 && (
              <>
                {openQuestions.length > 0 && answeredQuestions.length > 0 && (
                  <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide pt-1">Open ({openQuestions.length})</h2>
                )}
                {openQuestions.map((q: any) => (
                  <QuestionRow key={q.id} q={q} defaultOpen={deepLinkId === q.id} onReply={() => utils.submissions.allQuestions.invalidate()} />
                ))}
              </>
            )}
            {!qLoading && questions.length === 0 && (
              <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground text-sm">No questions yet.</CardContent></Card>
            )}
            {!qLoading && questions.length > 0 && openQuestions.length === 0 && !showAnswered && (
              <Card className="border-dashed"><CardContent className="py-6 text-center text-muted-foreground text-sm">All questions answered. ✓</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-3 mt-4">
            {/* Reviewed archive toggle */}
            {reviewedVideos.length > 0 && (
              <button
                id="reviewed-archive"
                onClick={() => setShowReviewed(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-sm"
              >
                <span className="font-medium text-muted-foreground">
                  {showReviewed ? "▾" : "▸"} Reviewed ({reviewedVideos.length})
                </span>
                <span className="text-xs text-muted-foreground">{showReviewed ? "Hide" : "View"}</span>
              </button>
            )}
            {showReviewed && reviewedVideos.map((v: any) => (
              <VideoRow key={v.id} v={v} defaultOpen={deepLinkId === v.id} onReview={() => utils.submissions.allVideos.invalidate()} />
            ))}
            {/* Pending videos */}
            {pendingVideos.length > 0 && (
              <>
                {pendingVideos.length > 0 && reviewedVideos.length > 0 && (
                  <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide pt-1">Pending Review ({pendingVideos.length})</h2>
                )}
                {pendingVideos.map((v: any) => (
                  <VideoRow key={v.id} v={v} defaultOpen={deepLinkId === v.id} onReview={() => utils.submissions.allVideos.invalidate()} />
                ))}
              </>
            )}
            {!vLoading && videos.length === 0 && (
              <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground text-sm">No video submissions yet.</CardContent></Card>
            )}
            {!vLoading && videos.length > 0 && pendingVideos.length === 0 && !showReviewed && (
              <Card className="border-dashed"><CardContent className="py-6 text-center text-muted-foreground text-sm">All videos reviewed. ✓</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
