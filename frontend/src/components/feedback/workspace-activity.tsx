import { useEffect, useState, useSyncExternalStore } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { idleRequestActivity, requestActivity } from "@/lib/backend-api/request-activity";

const serverSnapshot = () => idleRequestActivity;

/** Non-blocking feedback for all workspaces, including dialogs, login and candidate pages. */
export function WorkspaceActivity() {
  const activity = useSyncExternalStore(
    requestActivity.subscribe,
    requestActivity.getSnapshot,
    serverSnapshot,
  );
  const mutations = useIsMutating({ predicate: (mutation) => !mutation.state.isPaused });
  const pausedMutations = useIsMutating({ predicate: (mutation) => mutation.state.isPaused });
  const initialReads = useIsFetching({
    predicate: (query) =>
      query.getObserversCount() > 0 &&
      query.state.data === undefined &&
      !["notifications", "navigation", "navigation-counts", "auth"].includes(
        String(query.queryKey[0]),
      ),
  });
  const navigating = useRouterState({ select: (state) => state.isLoading });
  const busy = !!(
    activity.upload ||
    activity.download ||
    activity.write ||
    mutations ||
    navigating ||
    initialReads ||
    pausedMutations
  );
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    if (!busy) {
      setTakingLonger(false);
      return;
    }
    const timer = window.setTimeout(() => setTakingLonger(true), 8000);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const label = activity.upload
    ? "Uploading file…"
    : activity.download
      ? "Preparing download…"
      : activity.write || mutations
        ? "Processing request…"
        : navigating
          ? "Opening page…"
          : initialReads
            ? "Loading data…"
            : "Waiting for connection…";
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[120]"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {busy && (
        <>
          <div className="h-1 overflow-hidden bg-primary/15" aria-hidden>
            <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[request-progress_1.1s_ease-in-out_infinite]" />
          </div>
          <div className="absolute right-3 top-3 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-primary/20 bg-white/95 px-3 py-2 text-xs text-foreground shadow-sm">
            <Loader2
              className="size-4 shrink-0 text-primary motion-safe:animate-spin"
              aria-hidden
            />
            <span>
              {label}
              {label === "Waiting for connection…" ? (
                <span className="block text-[11px] text-muted-foreground">
                  This action is queued until you reconnect.
                </span>
              ) : (
                takingLonger && (
                  <span className="block text-[11px] text-muted-foreground">
                    Taking longer than usual. Please wait; no need to click again.
                  </span>
                )
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
