import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Play, RefreshCw, Loader2, BookOpen, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Video = {
  id: number;
  driveFileId: string;
  name: string;
  category: string;
  driveCreatedAt: string | null;
};

function getDriveEmbedUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Full-screen video modal
function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header bar — padded for iPhone safe area (notch/status bar) */}
      <div className="flex items-center justify-between px-4 bg-black/80 border-b border-white/10 shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="secondary" className="shrink-0 text-xs">{video.category}</Badge>
          <h2 className="text-white font-semibold text-sm sm:text-base truncate">{video.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="ml-4 shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Close video"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Video player — fills remaining space */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        <div className="w-full h-full max-w-6xl">
          <iframe
            src={getDriveEmbedUrl(video.driveFileId)}
            className="w-full h-full rounded-lg"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={video.name}
            style={{ minHeight: "300px" }}
          />
        </div>
      </div>

      {/* Bottom close button — always visible on mobile, respects home indicator safe area */}
      <div className="shrink-0 flex justify-center px-4 bg-black/80 border-t border-white/10 sm:hidden" style={{ paddingTop: '12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-colors"
        >
          <X className="h-4 w-4" /> Close Video
        </button>
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <Card
      className="overflow-hidden border border-border/60 hover:border-primary/40 transition-all hover:shadow-md cursor-pointer group"
      onClick={onPlay}
    >
      <div className="relative bg-muted aspect-video flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
            <Play className="h-6 w-6 text-white fill-white ml-1" />
          </div>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{video.name}</p>
        <div className="flex items-center justify-between mt-2">
          <Badge variant="secondary" className="text-xs">{video.category}</Badge>
          {video.driveCreatedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(video.driveCreatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function LearningLibrary() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  const categoriesQuery = trpc.library.categories.useQuery();
  const videosQuery = trpc.library.list.useQuery(
    { search: search || undefined, category: activeCategory !== "All" ? activeCategory : undefined }
  );

  const syncMutation = trpc.library.sync.useMutation({
    onSuccess: (result) => {
      const foundList = (result as any).found as string[] | undefined;
      const foundMsg = foundList?.length ? `\nDrive files: ${foundList.join(' | ')}` : '';
      toast.success(`Sync complete: ${result.synced} added/updated, ${(result as any).skipped ?? 0} skipped${foundMsg}`, { duration: 20000 });
      videosQuery.refetch();
      categoriesQuery.refetch();
    },
    onError: () => toast.error("Sync failed. Please try again."),
  });

  const categories = useMemo(() => ["All", ...(categoriesQuery.data ?? [])], [categoriesQuery.data]);
  const videos = (videosQuery.data ?? []) as Video[];

  return (
    <AppLayout>
      {/* Full-screen video modal */}
      {activeVideo && (
        <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Learning Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Past podcast episodes and educational videos from Regulated Kids.
            </p>
          </div>
          {user?.role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-2 self-start sm:self-auto"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync from Drive
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Video grid */}
        {videosQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {search || activeCategory !== "All"
              ? "No videos match your search."
              : "No videos yet. Sync from Drive to load the library."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} onPlay={() => setActiveVideo(video)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
