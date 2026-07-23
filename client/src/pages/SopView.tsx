import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { etDate } from "@/lib/utils";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, History, Loader2 } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { Streamdown } from "streamdown";

function SopContent({ content }: { content: string }) {
  const isHtml = content.trimStart().startsWith('<');
  if (isHtml) {
    return (
      <div
        className="sop-rich-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <Streamdown>{content}</Streamdown>
    </div>
  );
}
import { toast } from "sonner";

export default function SopView() {
  const { id } = useParams<{ id: string }>();
  const sopId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const sopSearch = useSearch() || window.location.search;
  const fromModuleId = new URLSearchParams(sopSearch).get('from');
  const fromTrackId = new URLSearchParams(sopSearch).get('trackId');

  const sopQuery = trpc.sops.byId.useQuery({ id: sopId }, { enabled: sopId > 0 });
  const versionsQuery = trpc.sops.versions.useQuery({ sopId }, { enabled: sopId > 0 });
  const reviewFlagsQuery = trpc.sops.myReviewFlags.useQuery();
  const markReviewed = trpc.sops.markReviewed.useMutation({
    onSuccess: () => {
      toast.success("Marked as reviewed");
      reviewFlagsQuery.refetch();
    },
  });

  const sop = sopQuery.data;
  const versions = versionsQuery.data ?? [];
  const flags = reviewFlagsQuery.data ?? [];
  const needsReview = flags.some((f: any) => f.sopId === sopId && !f.reviewedAt);

  if (sopQuery.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!sop) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">SOP not found.</p>
          <Button variant="ghost" onClick={() => setLocation("/sops")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-4 sm:mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/sops")} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to SOP Library
          </Button>
          {fromModuleId && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/modules/${fromModuleId}${fromTrackId ? `?trackId=${fromTrackId}` : ``}`)} className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
              <ArrowLeft className="h-4 w-4" />
              Back to Module
            </Button>
          )}
        </div>

        {/* Needs Review Banner */}
        {needsReview && (
          <div className="mb-6 p-4 bg-secondary border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">This SOP has been updated</p>
                <p className="text-xs text-foreground">Please review the latest version and mark it as reviewed.</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => markReviewed.mutate({ sopId })}
              disabled={markReviewed.isPending}
              className="shrink-0 gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              {markReviewed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark Reviewed
            </Button>
          </div>
        )}

        {/* SOP Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{sop.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">SOP</Badge>
                <span className="text-xs text-muted-foreground">Version {sop.version}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  Last updated {etDate(sop.lastUpdated, { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* SOP Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="pt-6">
              <SopContent content={sop.content} />
              </CardContent>
            </Card>

            {/* Mark Reviewed (bottom) */}
            {!needsReview && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markReviewed.mutate({ sopId })}
                  disabled={markReviewed.isPending}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Reviewed
                </Button>
              </div>
            )}
          </div>

          {/* Version History */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No previous versions</p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v: any) => (
                      <div key={v.id} className="border-l-2 border-border pl-3">
                        <p className="text-xs font-semibold text-foreground">v{v.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {etDate(v.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {v.changeNote && <p className="text-xs text-muted-foreground mt-0.5 italic">{v.changeNote}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
