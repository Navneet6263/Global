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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-violet-700 ring-1 ring-violet-200">
          <LockKeyhole className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">
            {owner ? `Currently claimed by ${owner}` : "Claim before reviewing"}
          </p>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Reserve this case to review evidence and submit your decision.
          </p>
        </div>
      </div>
      {!owner ? (
        <button
          onClick={onClaim}
          disabled={busy}
          aria-busy={loading}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
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
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
      : "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-4 py-3 text-[13px] font-semibold transition ${active ? activeClass : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      <Icon className="mr-2 inline h-4 w-4" />
      {label}
    </button>
  );
}
