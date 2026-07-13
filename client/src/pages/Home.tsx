import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import Dashboard from "./Dashboard";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    if (user.approvalStatus === "pending" || user.approvalStatus === "rejected") {
      setLocation("/pending");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.approvalStatus !== "approved") return null;

  return <Dashboard />;
}
