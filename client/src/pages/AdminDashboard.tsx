import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Loader2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  ca: "CA",
  associate_doctor: "Assoc. Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  const statsQuery = trpc.admin.stats.useQuery();
  const summaryQuery = trpc.users.progressSummary.useQuery();
  const pendingQuery = trpc.users.pending.useQuery();

  const stats = statsQuery.data;
  const summaries = summaryQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  if (loading) return null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Team onboarding overview and management</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: "Total Team Members", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pending Approval", value: pending.length, icon: Clock, color: "text-primary", bg: "bg-secondary" },
            { label: "Onboarding Complete", value: summaries.filter(s => s.isComplete).length, icon: Trophy, color: "text-primary", bg: "bg-secondary" },
            { label: "Avg. Progress", value: summaries.length > 0 ? `${Math.round(summaries.reduce((a, s) => a + s.progressPct, 0) / summaries.length)}%` : "—", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Approvals */}
        {pending.length > 0 && (
          <Card className="mb-6 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <AlertCircle className="h-4 w-4" />
                Pending Approvals ({pending.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pending.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <button
                      onClick={() => setLocation("/admin/users")}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Review →
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Hire Prep Checklist Quick Access */}
        {summaries.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  New Hire Prep Checklist
                </CardTitle>
                <span className="text-xs text-muted-foreground">One month before start date</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Open a team member&apos;s prep checklist to track name tag ordering, binder setup, welcome gift, and training review.
              </p>
              <div className="flex flex-wrap gap-2">
                {summaries.slice(0, 6).map((s: any) => (
                  <Button
                    key={s.user.id}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => setLocation(`/admin/prep/${s.user.id}`)}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {s.user.name?.split(" ")[0] ?? "Team Member"}
                  </Button>
                ))}
                {summaries.length > 6 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLocation("/admin/users")}>
                    +{summaries.length - 6} more
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Progress Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Team Onboarding Progress
              </CardTitle>
              <button onClick={() => setLocation("/admin/users")} className="text-xs text-primary hover:underline">
                Manage Users →
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : summaries.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No team members with assigned roles yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progress</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modules</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((s: any) => (
                      <tr key={s.user.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-foreground">{s.user.name}</p>
                            <p className="text-xs text-muted-foreground">{s.user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className="text-xs">
                            {s.user.teamRole ? ROLE_LABELS[s.user.teamRole] : "—"}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${s.progressPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground">{s.progressPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-xs text-muted-foreground">
                          {s.completedModules}/{s.totalModules}
                        </td>
                        <td className="py-3 px-2">
                          {s.isComplete ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </span>
                          ) : s.progressPct > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                              <Clock className="h-3.5 w-3.5" /> In Progress
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not Started</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
