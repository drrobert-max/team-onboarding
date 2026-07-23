import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { etDate } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Gift,
  Loader2,
  Printer,
  Tag,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

type PrepItem = {
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  note?: string;
};

const DEFAULT_ITEMS: PrepItem[] = [
  { key: "review_modules", label: "Review all training modules for this role and confirm they are current", completed: false, completedAt: null },
  { key: "check_videos", label: "Verify all videos, scripts, and SOPs are up to date", completed: false, completedAt: null },
  { key: "order_name_tag", label: "Order name tag", completed: false, completedAt: null },
  { key: "build_binder", label: "Set up 1-inch binder with SOPs relevant to daily tasks and processes", completed: false, completedAt: null },
  { key: "gift_tshirt", label: "Welcome gift: Reformation T-Shirt", completed: false, completedAt: null },
  { key: "gift_notebook", label: "Welcome gift: Notebook", completed: false, completedAt: null },
  { key: "gift_pens", label: "Welcome gift: Pens", completed: false, completedAt: null },
  { key: "gift_candle", label: "Welcome gift: Candle", completed: false, completedAt: null },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  review_modules: <UserCheck className="h-4 w-4 text-blue-500" />,
  check_videos: <BookOpen className="h-4 w-4 text-blue-500" />,
  order_name_tag: <Tag className="h-4 w-4 text-primary" />,
  build_binder: <ClipboardList className="h-4 w-4 text-primary" />,
  gift_tshirt: <Gift className="h-4 w-4 text-primary" />,
  gift_notebook: <Gift className="h-4 w-4 text-primary" />,
  gift_pens: <Gift className="h-4 w-4 text-primary" />,
  gift_candle: <Gift className="h-4 w-4 text-primary" />,
};

const SECTIONS = [
  {
    title: "Phase 1 — Training Review",
    description: "Complete one month before start date",
    keys: ["review_modules", "check_videos"],
  },
  {
    title: "Phase 1 — Physical Prep",
    description: "Order and prepare physical items",
    keys: ["order_name_tag", "build_binder"],
  },
  {
    title: "Phase 1 — Welcome Gift",
    description: "Standard gift: T-shirt, notebook, pens, candle",
    keys: ["gift_tshirt", "gift_notebook", "gift_pens", "gift_candle"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ca: "Chiropractic Assistant",
  associate_doctor: "Associate Doctor",
  scan_tech: "Scan Tech",
  preceptor: "Preceptor",
};

export default function NewHirePrepChecklist() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const newHireUserId = parseInt(params.userId ?? "0");

  const [items, setItems] = useState<PrepItem[]>(DEFAULT_ITEMS);
  const [binderSopIds, setBinderSopIds] = useState<number[]>([]);
  const [showBinderModal, setShowBinderModal] = useState(false);
  const [sopSearch, setSopSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") setLocation("/");
  }, [user, loading, setLocation]);

  const usersQuery = trpc.users.list.useQuery();
  const checklistQuery = trpc.admin.getPrepChecklist.useQuery(
    { newHireUserId },
    { enabled: newHireUserId > 0 }
  );
  const sopsQuery = trpc.admin.getSopsForBinder.useQuery();
  const utils = trpc.useUtils();
  const upsertMutation = trpc.admin.upsertPrepChecklist.useMutation({
    onSuccess: () => utils.admin.getPrepChecklist.invalidate({ newHireUserId }),
  });

  const newHire = usersQuery.data?.find((u) => u.id === newHireUserId);

  // Load saved checklist
  useEffect(() => {
    if (checklistQuery.data) {
      const saved = checklistQuery.data.items as PrepItem[];
      if (saved && saved.length > 0) setItems(saved);
      if (checklistQuery.data.binderSopIds) {
        setBinderSopIds(checklistQuery.data.binderSopIds as number[]);
      }
    }
  }, [checklistQuery.data]);

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  const filteredSops = useMemo(() => {
    const q = sopSearch.toLowerCase();
    return (sopsQuery.data ?? []).filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.categoryName ?? "").toLowerCase().includes(q)
    );
  }, [sopsQuery.data, sopSearch]);

  function toggleItem(key: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : null,
            }
          : item
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({
        newHireUserId,
        items,
        binderSopIds,
      });
      toast.success("Checklist saved");
    } catch {
      toast.error("Failed to save checklist");
    } finally {
      setSaving(false);
    }
  }

  function handlePrintBinder() {
    const selected = (sopsQuery.data ?? []).filter((s) => binderSopIds.includes(s.id));
    if (selected.length === 0) {
      toast.error("No SOPs selected for binder");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) return;
    const grouped: Record<string, typeof selected> = {};
    for (const s of selected) {
      const cat = s.categoryName ?? "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SOP Binder — ${newHire?.name ?? "New Hire"}</title>
        <style>
          body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; }
          h1 { font-size: 22px; border-bottom: 2px solid #c9a84c; padding-bottom: 8px; margin-bottom: 24px; }
          h2 { font-size: 15px; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; margin-bottom: 8px; }
          ul { margin: 0; padding-left: 20px; }
          li { margin-bottom: 6px; font-size: 14px; }
          .meta { font-size: 12px; color: #888; margin-bottom: 32px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>SOP Binder — ${newHire?.name ?? "New Hire"}</h1>
        <p class="meta">Role: ${ROLE_LABELS[newHire?.teamRole ?? ""] ?? "—"} &nbsp;|&nbsp; Prepared: ${etDate(new Date())}</p>
        ${Object.entries(grouped).map(([cat, sops]) => `
          <h2>${cat}</h2>
          <ul>${sops.map((s) => `<li>${s.title}</li>`).join("")}</ul>
        `).join("")}
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  if (loading || !newHireUserId) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation("/admin/users")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Team
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">New Hire Prep Checklist</h1>
              {newHire && (
                <p className="text-muted-foreground text-sm mt-1">
                  Preparing for{" "}
                  <span className="font-semibold text-foreground">{newHire.name}</span>
                  {newHire.teamRole && (
                    <span className="ml-2">
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[newHire.teamRole] ?? newHire.teamRole}
                      </Badge>
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handlePrintBinder}>
                <Printer className="h-4 w-4 mr-1.5" /> Print Binder
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <Card className="mb-6">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Overall Prep Progress</span>
              <span className="text-sm font-semibold text-primary">{completedCount}/{totalCount} complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary0 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Checklist sections */}
        {SECTIONS.map((section) => (
          <Card key={section.title} className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {section.keys.map((key) => {
                const item = items.find((i) => i.key === key);
                if (!item) return null;
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      item.completed
                        ? "bg-secondary border-border"
                        : "bg-card border-border hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleItem(key)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {SECTION_ICONS[key]}
                        <span
                          className={`text-sm font-medium ${
                            item.completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      {item.completed && item.completedAt && (
                        <p className="text-xs text-primary mt-0.5 ml-6">
                          Completed {etDate(item.completedAt)}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}

              {/* Binder SOP selector inline for build_binder */}
              {section.keys.includes("build_binder") && (
                <div className="mt-2 ml-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBinderModal(true)}
                    className="text-xs"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Select SOPs for Binder
                    {binderSopIds.length > 0 && (
                      <Badge className="ml-2 text-xs" variant="secondary">
                        {binderSopIds.length} selected
                      </Badge>
                    )}
                  </Button>
                  {binderSopIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {binderSopIds.length} SOP{binderSopIds.length !== 1 ? "s" : ""} selected for binder.{" "}
                      <button
                        className="text-primary hover:underline"
                        onClick={handlePrintBinder}
                      >
                        Print now
                      </button>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Binder SOP Selection Modal */}
      <Dialog open={showBinderModal} onOpenChange={setShowBinderModal}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select SOPs for Binder</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            <input
              type="text"
              placeholder="Search SOPs..."
              value={sopSearch}
              onChange={(e) => setSopSearch(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3 bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {sopsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              (() => {
                const grouped: Record<string, typeof filteredSops> = {};
                for (const s of filteredSops) {
                  const cat = s.categoryName ?? "Uncategorized";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(s);
                }
                return Object.entries(grouped).map(([cat, sopList]) => (
                  <div key={cat} className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">{cat}</p>
                    {sopList.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          binderSopIds.includes(s.id)
                            ? "bg-secondary border border-border"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={binderSopIds.includes(s.id)}
                          onCheckedChange={(checked) => {
                            setBinderSopIds((prev) =>
                              checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            );
                          }}
                        />
                        <span className="text-sm text-foreground">{s.title}</span>
                      </label>
                    ))}
                  </div>
                ));
              })()
            )}
          </div>
          <div className="flex justify-between items-center pt-3 border-t">
            <span className="text-sm text-muted-foreground">{binderSopIds.length} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBinderSopIds([])}>
                Clear All
              </Button>
              <Button size="sm" onClick={() => setShowBinderModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
