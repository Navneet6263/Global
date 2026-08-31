import { CloudUpload, MapPinned, Route, ShieldAlert, Wifi, WifiOff } from "lucide-react";

type SummaryCounts = {
  queued: number;
  active: number;
  exceptions: number;
  completed: number;
};

export function FieldRouteSummary({
  counts,
  online,
  pendingSync,
  syncing,
  onSync,
}: {
  counts: SummaryCounts;
  online: boolean;
  pendingSync: number;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-[var(--shadow-float)]">
      <div className="grid gap-4 p-4 sm:grid-cols-[1.15fr_0.85fr] sm:p-5">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-mint-deep p-5 text-white shadow-[var(--shadow-raise)]">
          <span
            aria-hidden
            className="absolute -right-9 -top-10 size-32 rounded-full bg-white/10"
          />
          <div className="relative flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
              Visit queue
            </p>
            <span className="grid size-9 place-items-center rounded-full bg-white/10">
              <Route className="size-4" aria-hidden />
            </span>
          </div>
          <p className="num relative mt-5 text-[2.75rem] font-medium leading-none tracking-[-0.05em]">
            {counts.queued}
          </p>
          <p className="relative mt-2 text-xs leading-5 text-white/65">
            visit{counts.queued === 1 ? "" : "s"} on your secure device queue, including recent
            completions
          </p>
          <div className="relative mt-5 flex flex-wrap gap-2">
            <MetricPill label="Active" value={counts.active} />
            <MetricPill label="Exceptions" value={counts.exceptions} warning />
            <MetricPill label="Done" value={counts.completed} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[1.4rem] bg-mint-soft/65 p-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/75 text-mint-deep">
                {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  online
                    ? "bg-success-soft text-success-foreground"
                    : "bg-warning-soft text-warning-foreground"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
            </div>
            <h2 className="mt-4 text-sm font-semibold">Secure sync</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {online
                ? pendingSync
                  ? `${pendingSync} local draft${pendingSync === 1 ? "" : "s"} waiting to upload.`
                  : "All visit activity on this device is synced."
                : "Capture continues offline. Drafts stay on this device until connection returns."}
            </p>
          </div>
          {pendingSync > 0 && online ? (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white text-xs font-semibold text-mint-deep shadow-[var(--shadow-card)] disabled:opacity-50"
            >
              <CloudUpload className={`size-4 ${syncing ? "animate-pulse" : ""}`} />
              {syncing ? "Syncing securely" : "Sync pending work"}
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/60 px-3 py-2.5 text-[10px] text-muted-foreground">
              {online ? (
                <MapPinned className="size-3.5 text-mint" />
              ) : (
                <ShieldAlert className="size-3.5 text-warning" />
              )}
              Location is captured only during visit actions.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricPill({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] ${warning && value ? "bg-warning/25 text-white" : "bg-white/10 text-white/80"}`}
    >
      <strong className="num font-semibold text-white">{value}</strong> {label}
    </span>
  );
}
