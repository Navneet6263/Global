import { CheckCircle2, LockKeyhole } from "lucide-react";

export function QaClaimState({
  owner,
  busy,
  onClaim,
}: {
  owner?: string | undefined;
  busy: boolean;
  onClaim: () => void;
}) {
  return (
    <div className="mt-5 rounded-[1.25rem] border border-review/20 bg-review-soft/60 p-4">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-review-foreground">
        <LockKeyhole className="h-4 w-4" />{" "}
        {owner ? `Currently claimed by ${owner}` : "Claim before reviewing"}
      </p>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Claiming prevents duplicate reviewer effort and preserves decision ownership.
      </p>
      {!owner ? (
        <button
          onClick={onClaim}
          disabled={busy}
          className="mt-3 rounded-full bg-review px-4 py-2.5 text-[11px] font-medium text-white shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Claiming…" : "Claim case"}
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
