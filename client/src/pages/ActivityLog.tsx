import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { etDateTime } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Monitor,
  Trophy,
  XCircle,
  BookOpen,
  Award,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  module_started:       { label: "Module Started",         icon: BookOpen,     color: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  module_completed:     { label: "Module Completed",       icon: CheckCircle2, color: "text-emerald-600",badge: "bg-emerald-100 text-emerald-700" },
  quiz_passed:          { label: "Quiz Passed",            icon: Trophy,       color: "text-primary",    badge: "bg-primary/10 text-primary" },
  quiz_failed:          { label: "Quiz Failed",            icon: XCircle,      color: "text-red-600",    badge: "bg-red-100 text-red-700" },
  test_out_graded:      { label: "Test-Out Graded",        icon: Award,        color: "text-amber-600",  badge: "bg-amber-100 text-amber-700" },
  software_access_granted: { label: "Software Access",    icon: Monitor,      color: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
};

const ROLE_LABELS: Record<string, string> = {
  ca: "CA",
  scan_tech: "Scan Tech",
  associate_doctor: "Assoc. Doctor",
  preceptor: "Preceptor",
};

const PAGE_SIZE = 50;

export default function ActivityLogPage() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  const usersQuery = trpc.users.list.useQuery();
  const logsQuery = trpc.activityLog.list.useQuery(
    { userId: selectedUserId, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { keepPreviousData: true } as any
  );

  const allLogs = logsQuery.data ?? [];
  const filteredLogs = selectedEventType === "all"
    ? allLogs
    : allLogs.filter((l) => l.eventType === selectedEventType);

  const approvedUsers = (usersQuery.data ?? []).filter(
    (u) => u.approvalStatus === "approved" && u.teamRole
  );

  function formatTime(ts: Date | string) {
    return etDateTime(ts, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function parseMetadata(raw: string | null) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground">Track trainee actions and timestamps</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

              {/* Trainee filter */}
              <select
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedUserId ?? ""}
                onChange={(e) => {
                  setSelectedUserId(e.target.value ? Number(e.target.value) : undefined);
                  setPage(0);
                }}
              >
                <option value="">All Trainees</option>
                {approvedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({ROLE_LABELS[u.teamRole ?? ""] ?? u.teamRole})
                  </option>
                ))}
              </select>

              {/* Event type filter */}
              <select
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedEventType}
                onChange={(e) => { setSelectedEventType(e.target.value); setPage(0); }}
              >
                <option value="all">All Events</option>
                {Object.entries(EVENT_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>

              {/* Clear */}
              {(selectedUserId || selectedEventType !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => { setSelectedUserId(undefined); setSelectedEventType("all"); setPage(0); }}
                >
                  Clear filters
                </Button>
              )}

              <span className="ml-auto text-xs text-muted-foreground">
                {logsQuery.isLoading ? "Loading…" : `${filteredLogs.length} events`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Log Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No activity yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Events will appear here as trainees use the app.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const meta = EVENT_META[log.eventType] ?? {
                    label: log.eventType,
                    icon: Activity,
                    color: "text-muted-foreground",
                    badge: "bg-secondary text-secondary-foreground",
                  };
                  const Icon = meta.icon;
                  const parsed = parseMetadata(log.metadata);

                  return (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                      {/* Icon */}
                      <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {(log as any).userName ?? "Unknown"}
                          </span>
                          <Badge className={`text-[10px] px-2 py-0 ${meta.badge}`}>
                            {meta.label}
                          </Badge>
                          {/* Extra metadata badges */}
                          {parsed?.score !== undefined && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {parsed.score}%
                            </Badge>
                          )}
                          {parsed?.grade && (
                            <Badge
                              className={`text-[10px] px-2 py-0 ${parsed.grade === "mastered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {parsed.grade === "mastered" ? "Mastered" : "Needs Improvement"}
                            </Badge>
                          )}
                          {parsed?.softwareName && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {parsed.softwareName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {log.description}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </p>
                        {(log as any).userEmail && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate max-w-[160px]">
                            {(log as any).userEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!logsQuery.isLoading && allLogs.length >= PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={allLogs.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
