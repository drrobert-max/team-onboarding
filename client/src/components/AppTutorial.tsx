import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Map,
  Sparkles,
  ClipboardList,
  BookOpen,
  Library,
  MessageCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const TUTORIAL_KEY = "rc_tutorial_seen_v1";

const STEPS = [
  {
    icon: LayoutDashboard,
    color: "bg-green-100 text-green-700",
    label: "Dashboard",
    title: "Your Home Base",
    description:
      "See your current week's modules, overall progress, quick stats, and notifications. Use the 'Completed Weeks' button to revisit past weeks.",
  },
  {
    icon: Map,
    color: "bg-blue-100 text-blue-700",
    label: "My Track",
    title: "Your Full Training Map",
    description:
      "View your entire training track from Week 1 to the end — every week and every module in order. Great for seeing the big picture of where you are and what's ahead.",
  },
  {
    icon: Sparkles,
    color: "bg-yellow-100 text-yellow-700",
    label: "Daily Focus",
    title: "Today's Priority",
    description:
      "A curated view of what you should focus on today. Keeps you on track without having to dig through your full week.",
  },
  {
    icon: ClipboardList,
    color: "bg-purple-100 text-purple-700",
    label: "Test Outs",
    title: "Prove Your Knowledge",
    description:
      "Complete your weekly test-out to unlock the next week. Each test-out confirms you've mastered the material before moving forward.",
  },
  {
    icon: BookOpen,
    color: "bg-orange-100 text-orange-700",
    label: "SOPs",
    title: "Standard Operating Procedures",
    description:
      "Your reference library for all clinic SOPs — scripts, protocols, and procedures. Searchable and organized by category.",
  },
  {
    icon: Library,
    color: "bg-teal-100 text-teal-700",
    label: "Learning Library",
    title: "Extra Resources",
    description:
      "Supplemental videos, documents, and resources beyond your weekly modules. Browse by topic whenever you need a deeper dive.",
  },
  {
    icon: MessageCircle,
    color: "bg-rose-100 text-rose-700",
    label: "Submissions",
    title: "Ask Questions",
    description:
      "Submit questions to Dr. Rob and Selena directly from any module, or view your past submissions and replies here.",
  },
];

export function AppTutorial() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-show on first login
  useEffect(() => {
    if (!user) return;
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) {
      // Small delay so the app loads first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    setOpen(false);
    setStep(0);
  };

  const handleOpen = () => {
    setStep(0);
    setOpen(true);
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <>
      {/* Persistent help button — sits above the mobile bottom nav (64px) + safe area */}
      <button
        onClick={handleOpen}
        className="fixed right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 text-sm font-semibold"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px + 12px)',
        }}
        aria-label="App Tutorial"
        title="App Tutorial"
      >
        <HelpCircle className="w-4 h-4 shrink-0" />
        <span>App Tour</span>
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-sm mx-auto p-0 overflow-hidden rounded-2xl">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-bold text-foreground">
              App Overview
            </DialogTitle>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-3">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? "w-6 bg-primary"
                      : i < step
                      ? "w-3 bg-primary/40"
                      : "w-3 bg-muted"
                  }`}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>
          </DialogHeader>

          {/* Step content */}
          <div className="px-6 py-6">
            <div className={`w-14 h-14 rounded-2xl ${current.color} flex items-center justify-center mb-4`}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {current.label}
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <span className="text-xs text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
            {isLast ? (
              <Button size="sm" onClick={handleClose} className="gap-1">
                Done
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
