import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./_core/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { useState } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";
import InstallPrompt from "./components/InstallPrompt";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import PendingApproval from "./pages/PendingApproval";
import Dashboard from "./pages/Dashboard";
import MyTrack from "./pages/MyTrack";
import ModuleView from "./pages/ModuleView";
import SopLibrary from "./pages/SopLibrary";
import SopView from "./pages/SopView";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import ActivityLogPage from "./pages/ActivityLog";
import Submissions from "./pages/Submissions";
import AdminSubmissions from "./pages/AdminSubmissions";
import NewHirePrepChecklist from "./pages/NewHirePrepChecklist";
import TestOuts from "./pages/TestOuts";
import DailyFocus from "./pages/DailyFocus";
import ResetPassword from "./pages/ResetPassword";
import TrackEditor from "./pages/TrackEditor";
import LearningLibrary from "./pages/LearningLibrary";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/pending" component={PendingApproval} />
      <Route path="/my-track" component={MyTrack} />
      <Route path="/modules/:id" component={ModuleView} />
      <Route path="/test-outs" component={TestOuts} />
      <Route path="/daily-focus" component={DailyFocus} />
      <Route path="/sops" component={SopLibrary} />
      <Route path="/sops/:id" component={SopView} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/prep/:userId" component={NewHirePrepChecklist} />
      <Route path="/admin/activity" component={ActivityLogPage} />
      <Route path="/admin/submissions" component={AdminSubmissions} />
      <Route path="/admin/tracks" component={TrackEditor} />
      <Route path="/submissions" component={Submissions} />
      <Route path="/library" component={LearningLibrary} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithSplash() {
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone && (
        <SplashScreen
          isReady={!loading}
          onDone={() => setSplashDone(true)}
        />
      )}
      {splashDone && <InstallPrompt />}
      <Router />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AppWithSplash />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
