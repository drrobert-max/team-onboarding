import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Invalid email or password");
    },
  });

  const forgotMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setForgotSent(true);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send reset email");
    },
  });

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.approvalStatus === "pending") setLocation("/pending");
      else if (user.approvalStatus === "approved") setLocation("/");
      else setLocation("/pending");
    }
  }, [user, loading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    loginMutation.mutate({ email, password });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    forgotMutation.mutate({ email: forgotEmail, origin: window.location.origin });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.28_0.06_145)] to-[oklch(0.18_0.04_145)]">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-6 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="white" fillOpacity="0.15"/>
              <path d="M16 8v8l5 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reformation</h1>
          <p className="text-white/60 font-medium mt-1 tracking-wide text-sm uppercase">Training Hub</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!showForgot ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back</h2>
              <p className="text-muted-foreground text-sm mb-6">Sign in to access your training portal.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@reformationchiropractic.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full py-3 rounded-xl bg-[oklch(0.32_0.08_145)] hover:bg-[oklch(0.28_0.08_145)] text-white font-semibold transition-all duration-200 shadow-sm disabled:opacity-60"
                >
                  {loginMutation.isPending ? "Signing in…" : "Sign In"}
                </button>
              </form>
              <button
                onClick={() => setShowForgot(true)}
                className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground transition text-center"
              >
                Forgot your password?
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
              >
                ← Back to sign in
              </button>
              <h2 className="text-xl font-semibold text-foreground mb-1">Reset Password</h2>
              {forgotSent ? (
                <div className="mt-4 p-4 bg-green-50 rounded-xl text-sm text-green-700">
                  If an account exists for <strong>{forgotEmail}</strong>, a reset link has been sent. Check your email.
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-6">Enter your email and we'll send you a reset link.</p>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="you@reformationchiropractic.com"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotMutation.isPending}
                      className="w-full py-3 rounded-xl bg-[oklch(0.32_0.08_145)] hover:bg-[oklch(0.28_0.08_145)] text-white font-semibold transition-all duration-200 shadow-sm disabled:opacity-60"
                    >
                      {forgotMutation.isPending ? "Sending…" : "Send Reset Link"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground text-center mt-6">
            Access restricted to Reformation Chiropractic team members only.
          </p>
        </div>
      </div>
    </div>
  );
}
