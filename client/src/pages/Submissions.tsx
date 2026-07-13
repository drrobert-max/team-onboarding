import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Video, Upload, ChevronDown, ChevronUp, Play, Send } from "lucide-react";
import { useLocation, useSearch } from "wouter";

// ─── Thread Bubble ────────────────────────────────────────────────────────────
function ThreadBubble({ msg }: { msg: { message: string; userName: string | null; userRole: string | null; createdAt: Date | string } }) {
  const isAdmin = msg.userRole === "admin";
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        <p className={`text-[11px] font-semibold mb-1 ${isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {msg.userName ?? (isAdmin ? "Leadership" : "You")}
        </p>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
        <p className={`text-[10px] mt-1 ${isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {new Date(msg.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ─── Question Thread Card ─────────────────────────────────────────────────────
function QuestionCard({ q, defaultOpen }: { q: any; defaultOpen?: boolean }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: replies = [], isLoading: rLoading } = trpc.submissions.getQuestionReplies.useQuery(
    { questionId: q.id },
    { enabled: open }
  );

  const addReply = trpc.submissions.addQuestionReply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.submissions.getQuestionReplies.invalidate({ questionId: q.id });
      utils.submissions.myQuestions.invalidate();
    },
    onError: () => toast.error("Failed to send reply."),
  });

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, replies.length]);

  return (
    <Card className="border border-border" id={`question-${q.id}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2">{q.question}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(q.createdAt).toLocaleDateString()} · {q.moduleName ? `Module: ${q.moduleName}` : "General"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={q.status === "answered" ? "default" : "secondary"} className={q.status === "answered" ? "bg-green-600 text-white" : ""}>
              {q.status === "answered" ? "Answered" : "Pending"}
            </Badge>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {/* Original question bubble */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground">
                <p className="text-[11px] font-semibold mb-1 text-muted-foreground">You (original question)</p>
                <p className="whitespace-pre-wrap leading-relaxed">{q.question}</p>
                <p className="text-[10px] mt-1 text-muted-foreground">{new Date(q.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Thread replies */}
            {rLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading thread...</p>
            ) : (
              replies.map((r: any) => <ThreadBubble key={r.id} msg={r} />)
            )}

            {/* Reply box */}
            <div className="flex gap-2 pt-1">
              <Textarea
                placeholder="Reply..."
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
              <Button
                size="sm"
                className="self-end"
                disabled={!replyText.trim() || addReply.isPending}
                onClick={() => { if (replyText.trim()) addReply.mutate({ questionId: q.id, message: replyText.trim() }); }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div ref={bottomRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Video Thread Card ────────────────────────────────────────────────────────
function VideoCard({ v, defaultOpen }: { v: any; defaultOpen?: boolean }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const presign = trpc.storage.presign.useQuery({ key: v.fileKey }, { enabled: open && !!v.fileKey });
  const voicePresign = trpc.storage.presign.useQuery({ key: v.voiceFeedbackKey ?? "" }, { enabled: open && !!v.voiceFeedbackKey });

  const { data: replies = [], isLoading: rLoading } = trpc.submissions.getVideoReplies.useQuery(
    { videoSubmissionId: v.id },
    { enabled: open }
  );

  const addReply = trpc.submissions.addVideoReply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.submissions.getVideoReplies.invalidate({ videoSubmissionId: v.id });
    },
    onError: () => toast.error("Failed to send reply."),
  });

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, replies.length]);

  return (
    <Card className="border border-border" id={`video-${v.id}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{v.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(v.createdAt).toLocaleDateString()} · {v.moduleName ? `Module: ${v.moduleName}` : "General"} · {v.fileName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={v.status === "reviewed" ? "default" : "secondary"} className={v.status === "reviewed" ? "bg-green-600 text-white" : ""}>
              {v.status === "reviewed" ? "Reviewed" : "Pending"}
            </Badge>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {presign.data?.url && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Your Video</p>
                <video src={presign.data.url} controls className="w-full max-h-64 rounded-md bg-black" />
              </div>
            )}
            {v.feedback && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-primary text-primary-foreground">
                  <p className="text-[11px] font-semibold mb-1 text-primary-foreground/70">Leadership Feedback</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{v.feedback}</p>
                </div>
              </div>
            )}
            {v.voiceFeedbackKey && voicePresign.data?.url && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Voice Feedback</p>
                <audio src={voicePresign.data.url} controls className="w-full" />
              </div>
            )}

            {/* Thread replies */}
            {rLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading thread...</p>
            ) : (
              replies.map((r: any) => <ThreadBubble key={r.id} msg={r} />)
            )}

            {v.status !== "reviewed" && replies.length === 0 && !v.feedback && (
              <p className="text-sm text-muted-foreground italic">Awaiting feedback from leadership.</p>
            )}

            {/* Reply box */}
            <div className="flex gap-2 pt-1">
              <Textarea
                placeholder="Reply..."
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
              <Button
                size="sm"
                className="self-end"
                disabled={!replyText.trim() || addReply.isPending}
                onClick={() => { if (replyText.trim()) addReply.mutate({ videoSubmissionId: v.id, message: replyText.trim() }); }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div ref={bottomRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Submissions() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const searchString = useSearch() || window.location.search;
  const urlParams = new URLSearchParams(searchString);
  const urlTab = urlParams.get("tab") ?? "questions";
  const urlModule = urlParams.get("module") ?? "";
  const fromModuleId = urlParams.get("from");
  const fromTrackId = urlParams.get("trackId");
  const deepLinkId = urlParams.get("id") ? Number(urlParams.get("id")) : null;

  const [activeTab, setActiveTab] = useState(urlTab === "videos" ? "videos" : "questions");

  const { data: myQuestions = [], isLoading: qLoading } = trpc.submissions.myQuestions.useQuery();
  const [question, setQuestion] = useState("");
  const submitQ = trpc.submissions.submitQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question submitted! Leadership will respond soon.");
      setQuestion("");
      utils.submissions.myQuestions.invalidate();
    },
    onError: () => toast.error("Failed to submit question. Please try again."),
  });

  const { data: myVideos = [], isLoading: vLoading } = trpc.submissions.myVideos.useQuery();
  const [videoTitle, setVideoTitle] = useState(urlModule && urlTab === "videos" ? urlModule : "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const presignUpload = trpc.storage.presignUpload.useMutation();
  const submitVideo = trpc.submissions.submitVideo.useMutation({
    onSuccess: () => {
      toast.success("Video submitted for review!");
      setVideoTitle("");
      setVideoFile(null);
      if (fileRef.current) fileRef.current.value = "";
      utils.submissions.myVideos.invalidate();
    },
    onError: () => toast.error("Failed to submit video. Please try again."),
  });

  // Scroll to deep-linked item after data loads
  useEffect(() => {
    if (!deepLinkId) return;
    const type = activeTab === "videos" ? "video" : "question";
    const el = document.getElementById(`${type}-${deepLinkId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [deepLinkId, activeTab, myQuestions.length, myVideos.length]);

  async function handleVideoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile || !videoTitle.trim()) return;
    if (videoFile.size > 500 * 1024 * 1024) { toast.error("File too large. Max 500MB."); return; }
    setUploading(true);
    try {
      // Upload via server to avoid mobile Safari CORS issues with direct S3 PUT
      const formData = new FormData();
      formData.append("file", videoFile, videoFile.name);
      const uploadResp = await fetch("/api/upload/video", { method: "POST", body: formData });
      if (!uploadResp.ok) {
        const errBody = await uploadResp.json().catch(() => ({ error: uploadResp.statusText }));
        throw new Error(`Upload failed: ${errBody.error ?? uploadResp.status}`);
      }
      const { key: finalKey, storageUrl } = await uploadResp.json() as { key: string; storageUrl: string };
      await submitVideo.mutateAsync({ title: videoTitle.trim(), fileKey: finalKey, fileUrl: storageUrl, fileName: videoFile.name, moduleName: urlModule || undefined });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VideoUpload] Error:', msg);
      toast.error(`Upload failed: ${msg}`);
    }
    finally { setUploading(false); }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          {fromModuleId && (
            <Button variant="ghost" size="sm" onClick={() => setLocation(`/modules/${fromModuleId}${fromTrackId ? `?trackId=${fromTrackId}` : ``}`)} className="gap-2 -ml-2 mb-3 text-primary hover:bg-primary/5">
              <ArrowLeft className="h-4 w-4" /> Back to Module
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground">Submission Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Ask questions and submit script videos for leadership feedback.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="questions" className="flex-1 gap-2">
              <MessageCircle className="w-4 h-4" /> Questions
              {myQuestions.filter((q: any) => q.status === "answered").length > 0 && (
                <Badge className="bg-green-600 text-white text-xs ml-1">{myQuestions.filter((q: any) => q.status === "answered").length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-1 gap-2">
              <Video className="w-4 h-4" /> Script Videos
            </TabsTrigger>
          </TabsList>

          {/* ── Questions Tab ── */}
          <TabsContent value="questions" className="space-y-4 mt-4">
            {urlModule && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                Asking about: <span className="font-medium">{urlModule}</span>
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Ask a Question</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={e => { e.preventDefault(); if (question.trim()) submitQ.mutate({ question: question.trim(), moduleName: urlModule || undefined }); }} className="space-y-3">
                  <Textarea placeholder="Type your question here..." value={question} onChange={e => setQuestion(e.target.value)} rows={3} maxLength={2000} className="resize-none" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{question.length}/2000</span>
                    <Button type="submit" disabled={!question.trim() || submitQ.isPending} size="sm">
                      {submitQ.isPending ? "Submitting..." : "Submit Question"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Questions ({myQuestions.length})</h2>
              {qLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
                : myQuestions.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No questions yet. Ask your first question above.</CardContent></Card>
                ) : (
                  myQuestions.map((q: any) => <QuestionCard key={q.id} q={q} defaultOpen={deepLinkId === q.id && activeTab === "questions"} />)
                )}
            </div>
          </TabsContent>

          {/* ── Videos Tab ── */}
          <TabsContent value="videos" className="space-y-4 mt-4">
            {urlModule && urlTab === "videos" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                Submitting video for: <span className="font-medium">{urlModule}</span>
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Submit a Script Video</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVideoSubmit} className="space-y-3">
                  <Input placeholder="Video title (e.g. Day 1 Education Script)" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} maxLength={255} />
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
                    {videoFile ? (
                      <div className="space-y-1">
                        <Play className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-sm font-medium text-foreground">{videoFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Tap to select a video from your device</p>
                        <p className="text-xs text-muted-foreground">MP4, MOV, WebM · Max 500MB</p>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <Button type="submit" disabled={!videoFile || !videoTitle.trim() || uploading || submitVideo.isPending} className="w-full">
                    {uploading ? "Uploading..." : submitVideo.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Submissions ({myVideos.length})</h2>
              {vLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
                : myVideos.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">No videos submitted yet.</CardContent></Card>
                ) : (
                  myVideos.map((v: any) => <VideoCard key={v.id} v={v} defaultOpen={deepLinkId === v.id && activeTab === "videos"} />)
                )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
