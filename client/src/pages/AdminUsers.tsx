import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Users,
  XCircle,
  UserPlus,
  Trash2,
  Mail,
  ChevronRight,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Circle,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "ca", label: "Chiropractic Assistant" },
  { value: "associate_doctor", label: "Associate Doctor" },
  { value: "scan_tech", label: "Scan Tech" },
  { value: "preceptor", label: "Preceptor" },
];

const ROLE_LABELS: Record<string, string> = {
  ca: "CA",
  associate_doctor: "Assoc. Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

const STATUS_CONFIG = {
  on_track: { label: "On Track", color: "text-green-600", bg: "bg-green-50", icon: TrendingUp },
  behind: { label: "Behind", color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle },
  test_out_soon: { label: "Test-Out Soon", color: "text-red-600", bg: "bg-red-50", icon: Clock },
  complete: { label: "Complete", color: "text-blue-600", bg: "bg-blue-50", icon: CheckCircle },
};

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-muted overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function TraineeDetailPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.users.traineeDetail.useQuery({ userId });
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground p-4">No data found.</p>;

  const { user, track, weeks, activity } = data;
  const totalDone = weeks.reduce((s, w) => s + w.doneCount, 0);
  const totalAll = weeks.reduce((s, w) => s + w.totalCount, 0);
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {(user.name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">{track?.name ?? "No track"}</span>
          <span className="text-xs font-semibold text-foreground">{pct}%</span>
        </div>
        <ProgressBar value={pct} />
        <p className="text-xs text-muted-foreground mt-1">{totalDone} of {totalAll} modules complete</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Week-by-week breakdown */}
        <div className="p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Weekly Progress</p>
          <div className="space-y-2">
            {weeks.map((week) => {
              const weekPct = week.totalCount > 0 ? Math.round((week.doneCount / week.totalCount) * 100) : 0;
              const isExpanded = expandedWeek === week.milestoneId;
              const allDone = week.doneCount === week.totalCount && week.totalCount > 0;
              return (
                <div key={week.milestoneId} className="border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors text-left"
                    onClick={() => setExpandedWeek(isExpanded ? null : week.milestoneId)}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${allDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {allDone ? <CheckCircle2 className="w-4 h-4" /> : week.weekNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-foreground truncate">{week.title}</p>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{week.doneCount}/{week.totalCount}</span>
                      </div>
                      <ProgressBar value={weekPct} />
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border bg-secondary/20 px-3 py-2 space-y-1.5">
                      {week.modules.map((mod) => (
                        <div key={mod.id} className="flex items-center gap-2">
                          {mod.status === "completed" ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : mod.status === "in_progress" ? (
                            <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={`text-xs ${mod.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {mod.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        {activity.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="space-y-2">
              {activity.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{log.description}</p>
                    <p className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [approveModal, setApproveModal] = useState<{ userId: number; name: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [detailUserId, setDetailUserId] = useState<number | null>(null);

  // Create User state
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newTeamRole, setNewTeamRole] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  const usersQuery = trpc.users.list.useQuery();
  const progressQuery = trpc.users.progressSummary.useQuery();

  const approveUser = trpc.users.approve.useMutation({
    onSuccess: () => {
      toast.success("User approved successfully");
      usersQuery.refetch();
      progressQuery.refetch();
      setApproveModal(null);
      setSelectedRole("");
    },
    onError: () => toast.error("Failed to update user"),
  });
  const rejectUser = trpc.users.approve.useMutation({
    onSuccess: () => {
      toast.success("User rejected");
      usersQuery.refetch();
    },
    onError: () => toast.error("Failed to update user"),
  });
  const setRole = trpc.users.setRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      usersQuery.refetch();
      progressQuery.refetch();
    },
    onError: () => toast.error("Failed to update role"),
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const resendInvite = trpc.users.resendInvite.useMutation({
    onSuccess: () => toast.success("Invite email resent"),
    onError: (err) => toast.error(err.message || "Failed to resend invite"),
  });
  const deleteUser = trpc.users.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      usersQuery.refetch();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message || "Failed to delete user"),
  });
  const updateUser = trpc.users.updateUser.useMutation({
    onSuccess: () => { toast.success("Test-out date updated"); usersQuery.refetch(); progressQuery.refetch(); },
    onError: () => toast.error("Failed to update"),
  });
  const createUser = trpc.users.createUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      usersQuery.refetch();
      setCreateModal(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewTeamRole(""); setNewUserRole("user");
    },
    onError: (err) => toast.error(err.message || "Failed to create user"),
  });

  const allUsers = usersQuery.data ?? [];
  const pending = allUsers.filter(u => u.approvalStatus === "pending");
  const approved = allUsers.filter(u => u.approvalStatus === "approved");
  const rejected = allUsers.filter(u => u.approvalStatus === "rejected");

  // Build a map from userId → progress summary
  const progressMap = new Map((progressQuery.data ?? []).map(p => [p.user.id, p]));

  if (loading) return null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Create accounts, manage roles, and track trainee progress</p>
          </div>
          <Button onClick={() => setCreateModal(true)} className="flex items-center gap-2 shrink-0">
            <UserPlus className="w-4 h-4" />
            Create User
          </Button>
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <Card className="mb-6 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                Pending Approval ({pending.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pending.map(u => (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-secondary rounded-xl border border-border">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Joined {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectUser.mutate({ userId: u.id, status: "rejected" })}
                        disabled={rejectUser.isPending}
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => { setApproveModal({ userId: u.id, name: u.name ?? "" }); setSelectedRole(""); }}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Members — Progress Table */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Team Members ({approved.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : approved.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active team members yet.</p>
            ) : (
              <div className="space-y-3">
                {approved.map(u => {
                  const prog = progressMap.get(u.id);
                  const statusCfg = prog ? STATUS_CONFIG[prog.status] : null;
                  const StatusIcon = statusCfg?.icon;
                  return (
                    <div
                      key={u.id}
                      className="border border-border rounded-xl p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => setDetailUserId(u.id)}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {(u.name ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusCfg && StatusIcon && (
                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusCfg.label}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Progress bar */}
                      {prog && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {ROLE_LABELS[u.teamRole ?? ""] ?? u.teamRole ?? "No role"} · Week {prog.currentWeek ?? "—"}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{prog.progressPct}%</span>
                          </div>
                          <ProgressBar value={prog.progressPct} />
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">{prog.completedModules}/{prog.totalModules} modules</span>
                            {prog.currentWeekTotal > 0 && (
                              <span className="text-xs text-muted-foreground">
                                This week: {prog.currentWeekDone}/{prog.currentWeekTotal}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom row — controls */}
                      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        <Select
                          value={u.teamRole ?? ""}
                          onValueChange={(val) => setRole.mutate({ userId: u.id, teamRole: val as any })}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(r => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <input
                          type="date"
                          className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-32 h-7"
                          title="Test-out date"
                          value={u.testOutDate ? new Date(u.testOutDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => updateUser.mutate({ userId: u.id, testOutDate: e.target.value || null })}
                        />

                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs h-7 px-2">
                          {u.role}
                        </Badge>

                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setLocation(`/admin/prep/${u.id}`)}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            Prep
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Resend invite email"
                            onClick={() => resendInvite.mutate({ userId: u.id, origin: window.location.origin })}
                            disabled={resendInvite.isPending}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteUser.mutate({ userId: u.id })} disabled={deleteUser.isPending}>Confirm</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirm(u.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rejected */}
        {rejected.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                Rejected ({rejected.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rejected.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setApproveModal({ userId: u.id, name: u.name ?? "" }); setSelectedRole(""); }}
                    >
                      Re-approve
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trainee Detail Side Panel */}
      <Sheet open={detailUserId !== null} onOpenChange={(open) => { if (!open) setDetailUserId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Trainee Progress</SheetTitle>
          </SheetHeader>
          {detailUserId !== null && (
            <TraineeDetailPanel userId={detailUserId} onClose={() => setDetailUserId(null)} />
          )}
        </SheetContent>
      </Sheet>

      {/* Approve Modal */}
      <Dialog open={!!approveModal} onOpenChange={() => { setApproveModal(null); setSelectedRole(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve {approveModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Select a training role for this team member. This determines their onboarding track.</p>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={!selectedRole || approveUser.isPending}
                onClick={() => {
                  if (!approveModal || !selectedRole) return;
                  approveUser.mutate({
                    userId: approveModal.userId,
                    status: "approved",
                    teamRole: selectedRole as any,
                  });
                }}
              >
                {approveUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & Assign Role"}
              </Button>
              <Button variant="outline" onClick={() => { setApproveModal(null); setSelectedRole(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={createModal} onOpenChange={(open) => { if (!open) { setCreateModal(false); setNewName(""); setNewEmail(""); setNewPassword(""); setNewTeamRole(""); setNewUserRole("user"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                placeholder="Jane Smith"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="jane@reformationchiropractic.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">They can reset this via "Forgot Password" on the login page.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Training Role</Label>
              <Select value={newTeamRole} onValueChange={setNewTeamRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>System Access</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "user" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Trainee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1"
                disabled={!newName || !newEmail || !newPassword || !newTeamRole || createUser.isPending}
                onClick={() => {
                  if (!newName || !newEmail || !newPassword || !newTeamRole) return;
                  createUser.mutate({
                    name: newName,
                    email: newEmail,
                    password: newPassword,
                    teamRole: newTeamRole as any,
                    role: newUserRole,
                    origin: window.location.origin,
                  });
                }}
              >
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
              </Button>
              <Button variant="outline" onClick={() => setCreateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
