import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * True when an error looks like a stale code-split chunk after a deploy. Covers
 * both the explicit dynamic-import failures AND the "reading 'default'" TypeError
 * React throws when a lazy() route resolves to an empty/stale module — the exact
 * error users hit when a new build lands while their tab is open.
 */
function isStaleChunkError(error: Error): boolean {
  const msg = `${error?.message || ""} ${error?.stack || ""}`;
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /reading '?default'?/i.test(msg) ||
    /Unable to preload/i.test(msg)
  );
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // A failed dynamic import almost always means a stale code-split chunk after
    // a new deploy (its hashed filename was replaced). Reload once to pick up the
    // current build instead of showing the error screen. The timestamp guard
    // prevents a reload loop if the error is genuine and survives a reload.
    if (isStaleChunkError(error)) {
      const KEY = "chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
