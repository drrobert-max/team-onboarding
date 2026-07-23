import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { initials } from "@/lib/utils";
import {
  Activity,
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Map,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
  FlaskConical,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { AppTutorial } from "./AppTutorial";

const ROLE_LABELS: Record<string, string> = {
  ca: "Chiropractic Assistant",
  associate_doctor: "Associate Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notificationsQuery = trpc.notifications.mine.useQuery(undefined, {
    enabled: !!user && user.approvalStatus === "approved",
    refetchInterval: 60000,
  });
  const unreadCount = notificationsQuery.data?.filter(n => !n.isRead).length ?? 0;
  const markRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => notificationsQuery.refetch(),
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (user.approvalStatus === "pending" || user.approvalStatus === "rejected") {
      setLocation("/pending");
    }
  }, [user, loading, setLocation]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || user.approvalStatus !== "approved") return null;

  if (!user.teamRole && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Almost there!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            Your account is approved. An admin will assign your training role shortly — check back soon.
          </p>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground underline">Sign out</button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  const traineeNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Map, label: "My Track", path: "/my-track" },
    { icon: Sparkles, label: "Daily Focus", path: "/daily-focus" },
    { icon: ClipboardList, label: "Test Outs", path: "/test-outs" },
    { icon: BookOpen, label: "SOPs", path: "/sops" },
    { icon: Library, label: "Library", path: "/library" },
    { icon: MessageCircle, label: "Submissions", path: "/submissions" },
  ];

  const adminNavItems = [
    { icon: Users, label: "Team", path: "/admin/users" },
    { icon: GraduationCap, label: "Tracks", path: "/admin/tracks" },
    { icon: Activity, label: "Activity", path: "/admin/activity" },
    { icon: MessageCircle, label: "Inbox", path: "/admin/submissions" },
    { icon: FlaskConical, label: "QA", path: "/admin/uat" },
    { icon: Settings, label: "Admin", path: "/admin" },
  ];

  const navItems = [
    ...traineeNavItems,
    ...(isAdmin ? adminNavItems : []),
  ];

  // Mobile bottom tab: 4 primary items + More
  const mobileTabItems = traineeNavItems.slice(0, 4);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const isAdminSectionActive = isAdmin && adminNavItems.some(item => isActive(item.path));

  const userInitials = initials(user.name);
  const userRoleLabel = user.teamRole ? ROLE_LABELS[user.teamRole] : (isAdmin ? "Admin" : "Team Member");

  return (
    <div className="flex bg-[oklch(0.97_0.008_135)] overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Desktop Sidebar (lg+) ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0" style={{ background: 'var(--brand-gradient-hero)' }}>
        {/* Brand */}
        <div className="px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/rc-logo.webp"
                alt="RC"
                className="w-7 h-7 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Reformation</p>
              <p className="text-white/60 text-[10px] tracking-widest uppercase font-medium">Training Hub</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  active ? "bg-white/25" : ""
                }`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 shrink-0">
          <div className="rounded-xl bg-white/10 p-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-white/25 text-white text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-white/60 truncate">{userRoleLabel}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Mobile Top Bar (< lg) ── */}
        <header
          className="lg:hidden bg-white shrink-0 flex items-center justify-between px-4"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            paddingBottom: '12px',
            boxShadow: '0 1px 0 oklch(0.92 0.010 135)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center">
              <img
                src="/rc-logo.webp"
                alt="RC"
                className="w-6 h-6 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight">Training Hub</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'oklch(0.96 0.012 135)' }}
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5 text-foreground" style={{ width: '18px', height: '18px' }} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold px-0.5">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors"
                  style={{ background: 'oklch(0.96 0.012 135)' }}
                  aria-label="Account"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-foreground max-w-[70px] truncate">
                    {(user.name ?? '').split(' ')[0] || userInitials}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{userRoleLabel}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Desktop Top Bar (lg+) ── */}
        <header className="hidden lg:flex h-14 border-b border-border bg-white/80 backdrop-blur items-center justify-between px-6 shrink-0">
          <span className="text-sm font-semibold text-foreground/50 tracking-wide">Reformation Training Hub</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(62px + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </main>

        {/* ── App Tutorial ── */}
        <AppTutorial />

        {/* ── Mobile Bottom Tab Bar ── */}
        <nav
          className="lg:hidden"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--brand-dark)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.2)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            zIndex: 50,
          }}
        >
          <div className="flex items-center h-[62px] px-1">
            {mobileTabItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-all active:scale-95"
                >
                  {/* Icon container — raised square when active */}
                  <div
                    className="flex items-center justify-center rounded-[10px] transition-all duration-200"
                    style={{
                      width: '40px',
                      height: '30px',
                      background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                    }}
                  >
                    <item.icon
                      style={{
                        width: '18px',
                        height: '18px',
                        color: active ? 'white' : 'rgba(255,255,255,0.55)',

                        transition: 'color 0.15s ease',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'white' : 'rgba(255,255,255,0.55)',
                      lineHeight: 1,
                      transition: 'color 0.15s ease',

                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* "More" tab */}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-all active:scale-95"
            >
              <div
                className="flex items-center justify-center rounded-[10px] transition-all duration-200"
                style={{
                  width: '40px',
                  height: '30px',
                  background: isAdminSectionActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                }}
              >
                <MoreHorizontal
                  style={{
                    width: '18px',
                    height: '18px',
                    color: isAdminSectionActive ? 'white' : 'rgba(255,255,255,0.55)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isAdminSectionActive ? 700 : 500,
                  color: isAdminSectionActive ? 'white' : 'rgba(255,255,255,0.55)',
                  lineHeight: 1,
                }}
              >
                More
              </span>
            </button>
          </div>
        </nav>

      </div>

      {/* ── "More" Sheet ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
          <SheetHeader className="mb-5">
            <SheetTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">More</SheetTitle>
          </SheetHeader>

          {/* Trainee items not in bottom bar */}
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">Training</p>
            <div className="grid grid-cols-3 gap-3">
              {traineeNavItems.slice(4).map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95"
                    style={{
                      background: active ? 'var(--brand-light)' : 'oklch(0.97 0.008 135)',
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: active ? 'var(--brand-dark)' : 'white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      <item.icon
                        className="h-5 w-5"
                        style={{ color: active ? 'white' : 'var(--brand-dark)' }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Admin items */}
          {isAdmin && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">Admin</p>
              <div className="grid grid-cols-4 gap-3">
                {adminNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMoreOpen(false)}
                      className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95"
                      style={{
                        background: active ? 'var(--brand-light)' : 'oklch(0.97 0.008 135)',
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{
                          background: active ? 'var(--brand-dark)' : 'white',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        }}
                      >
                        <item.icon
                          className="h-4.5 w-4.5"
                          style={{ width: '18px', height: '18px', color: active ? 'white' : 'var(--brand-dark)' }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <button
              onClick={() => { logout(); setMoreOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {/* ── Notifications Sheet ── */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[80dvh] flex flex-col">
          <SheetHeader className="mb-4 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-bold text-foreground">Notifications</SheetTitle>
              {unreadCount > 0 && (
                <button
                  onClick={() => markRead.mutate()}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-2 pb-2">
            {(notificationsQuery.data ?? []).length === 0 && (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            )}
            {(notificationsQuery.data ?? []).map((n) => {
              const notifUrl = (() => {
                switch (n.type) {
                  case 'question_submitted': return `/admin/submissions?tab=questions${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                  case 'video_submitted': return `/admin/submissions?tab=videos${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                  case 'question_answered': return `/submissions?tab=questions${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                  case 'video_reviewed': return `/submissions?tab=videos${n.relatedId ? `&id=${n.relatedId}` : ''}`;
                  default: return null;
                }
              })();
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (notifUrl) {
                      markRead.mutate();
                      setNotifOpen(false);
                      setLocation(notifUrl);
                    }
                  }}
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl transition-colors"
                  style={{
                    background: n.isRead ? 'oklch(0.97 0.008 135)' : 'oklch(0.94 0.025 135)',
                    border: n.isRead ? '1px solid oklch(0.92 0.010 135)' : '1px solid oklch(0.85 0.040 135)',
                    cursor: notifUrl ? 'pointer' : 'default',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: n.isRead ? 'white' : 'var(--brand-light)' }}
                  >
                    <Bell className="h-3.5 w-3.5" style={{ color: n.isRead ? 'oklch(0.55 0.03 135)' : 'var(--brand-dark)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
