import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reset password. The link may have expired.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    resetMutation.mutate({ token, newPassword });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.28_0.06_145)] to-[oklch(0.18_0.04_145)]">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Reformation</h1>
          <p className="text-white/60 font-medium mt-1 tracking-wide text-sm uppercase">Training Hub</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Password Reset!</h2>
              <p className="text-muted-foreground text-sm">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-1">Set New Password</h2>
              <p className="text-muted-foreground text-sm mb-6">Choose a new password for your account.</p>
              {!token && (
                <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700 mb-4">
                  Invalid or missing reset token. Please request a new reset link.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetMutation.isPending || !token}
                  className="w-full py-3 rounded-xl bg-[oklch(0.32_0.08_145)] hover:bg-[oklch(0.28_0.08_145)] text-white font-semibold transition-all duration-200 shadow-sm disabled:opacity-60"
                >
                  {resetMutation.isPending ? "Saving…" : "Set New Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
