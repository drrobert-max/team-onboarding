import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, CheckCircle2, XCircle } from "lucide-react";

export default function PendingApproval() {
  const { user, logout } = useAuth();

  const isRejected = user?.approvalStatus === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary/80">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="oklch(0.18 0.012 250)" fillOpacity="0.9"/>
              <path d="M16 8v8l5 3" stroke="oklch(0.98 0 0)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reformation Training Hub</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {isRejected ? (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-14 w-14 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Access Not Granted</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Your account request was not approved at this time. Please contact your manager or Dr. Rob directly for assistance.
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Clock className="h-14 w-14 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Awaiting Approval</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Your account has been created and is pending admin approval. You'll receive access once a team admin approves your account and assigns your role.
              </p>
              <div className="bg-secondary rounded-xl p-4 text-left mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Signed in as</p>
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </>
          )}

          <Button
            variant="outline"
            onClick={logout}
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
