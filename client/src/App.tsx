import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./_core/hooks/useAuth";
import { lazy, Suspense, useState } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";
import InstallPrompt from "./components/InstallPrompt";
import { ThemeProvider } from "./contexts/ThemeContext";

// Route-level code splitting: each page loads on demand, keeping the initial
// bundle small (heavy deps like the markdown/diagram renderer only download
// when a page that uses them is opened).
const NotFound = lazy(() => import("@/pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyTrack = lazy(() => import("./pages/MyTrack"));
const ModuleView = lazy(() => import("./pages/ModuleView"));
const SopLibrary = lazy(() => import("./pages/SopLibrary"));
const SopView = lazy(() => import("./pages/SopView"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLog"));
const Submissions = lazy(() => import("./pages/Submissions"));
const AdminSubmissions = lazy(() => import("./pages/AdminSubmissions"));
const NewHirePrepChecklist = lazy(() => import("./pages/NewHirePrepChecklist"));
const TestOuts = lazy(() => import("./pages/TestOuts"));
const DailyFocus = lazy(() => import("./pages/DailyFocus"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TrackEditor = lazy(() => import("./pages/TrackEditor"));
const LearningLibrary = lazy(() => import("./pages/LearningLibrary"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
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
