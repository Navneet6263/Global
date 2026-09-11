import { CheckCircle2, LockKeyhole } from "lucide-react";

export function QaClaimState({
  owner,
  busy,
  loading,
  onClaim,
}: {
  owner?: string | undefined;
  busy: boolean;
  loading: boolean;
  onClaim: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-review/20 bg-review-soft/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-review-foreground">
          <LockKeyhole className="h-4 w-4" />{" "}
          {owner ? `Currently claimed by ${owner}` : "Claim before reviewing"}
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
          Reserve this case to review evidence and submit your decision.
        </p>
      </div>
      {!owner ? (
        <button
          onClick={onClaim}
          disabled={busy}
          aria-busy={loading}
          className="shrink-0 rounded-full bg-review px-4 py-2.5 text-[11px] font-medium text-white shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Claiming…" : "Claim case"}
        </button>
      ) : null}
    </div>
  );
}

export function QaDecisionButton({
  active,
  tone,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  tone: "approve" | "rework";
  onClick: () => void;
  icon: typeof CheckCircle2;
  label: string;
}) {
  const activeClass =
    tone === "approve"
      ? "border-success/30 bg-success-soft text-success-foreground"
      : "border-warning/30 bg-warning-soft text-warning-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[1rem] border px-4 py-3 text-[11px] font-medium transition ${active ? `${activeClass} shadow-[var(--shadow-card)]` : "border-border bg-white/60 text-muted-foreground hover:bg-white"}`}
    >
      <Icon className="mr-2 inline h-4 w-4" />
      {label}
    </button>
  );
}
