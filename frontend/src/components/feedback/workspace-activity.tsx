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
  const queued = label === "Waiting for connection…";
  // No top progress bar: buttons show their own spinner. A visible notice appears only
  // when work is queued offline or takes unusually long; screen readers always hear it.
  const notice = busy && (queued || takingLonger);
  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[120]"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {busy && !notice ? <span className="sr-only">{label}</span> : null}
      {notice && (
        <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-primary/20 bg-white/95 px-3 py-2 text-xs text-foreground shadow-sm">
          <Loader2 className="size-4 shrink-0 text-primary motion-safe:animate-spin" aria-hidden />
          <span>
            {label}
            <span className="block text-[11px] text-muted-foreground">
              {queued
                ? "This action is queued until you reconnect."
                : "Taking longer than usual. Please wait; no need to click again."}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
