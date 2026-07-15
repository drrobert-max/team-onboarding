import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2 } from "lucide-react";

export default function AdminImport() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [connectionString, setConnectionString] = useState("");

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  const utils = trpc.useUtils();
  const tracksQuery = trpc.tracks.all.useQuery();
  const alreadyHasTracks = (tracksQuery.data ?? []).length > 0;

  const importMutation = trpc.admin.importFromOldDb.useMutation({
    onSuccess: () => {
      utils.tracks.all.invalidate();
    },
  });

  if (loading) return null;

  const result = importMutation.data;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <DatabaseZap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Import from your old system</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Bring your existing training tracks, weeks, modules, and quizzes over from your previous platform — one time.
            </p>
          </div>
        </div>

        {/* Already imported */}
        {alreadyHasTracks && !result && (
          <Card className="border-primary/30">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-9 w-9 text-primary mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Your tracks are already set up</p>
              <p className="text-sm text-muted-foreground mt-1">
                This database already has training tracks, so importing is turned off to avoid duplicates.
              </p>
              <Button className="mt-4" onClick={() => setLocation("/admin/tracks")}>Go to Track Editor</Button>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {result && (
          <Card className="border-primary/40 bg-secondary/40 mb-4">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">Import complete</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Tracks", value: result.imported.tracks },
                  { label: "Weeks", value: result.imported.weeks },
                  { label: "Modules", value: result.imported.modules },
                  { label: "Quizzes", value: result.imported.quizzes },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-background border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {result.trackNames.length > 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Imported: {result.trackNames.join(", ")}
                </p>
              )}
              <Button onClick={() => setLocation("/admin/tracks")}>Open Track Editor</Button>
            </CardContent>
          </Card>
        )}

        {/* Import form */}
        {!alreadyHasTracks && !result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Connect your old database</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-300/60 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Paste the connection details for your old system's database. We use it once to copy your training
                    content — we don't save it. Only your content comes over (tracks, weeks, modules, quizzes); old
                    trainee history is left behind.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs">Old database connection string</Label>
                <textarea
                  id="cs"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="mysql://user:password@host:port/database?ssl=..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              {importMutation.isError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{importMutation.error.message}</p>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!connectionString.trim() || importMutation.isPending}
                onClick={() => importMutation.mutate({ connectionString })}
              >
                {importMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing…</>
                ) : (
                  "Import my training content"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This can take a moment for a large catalog. You only need to do it once.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
