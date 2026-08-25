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
    <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-violet-700">
        <LockKeyhole className="h-4 w-4" />{" "}
        {owner ? `Currently claimed by ${owner}` : "Claim before reviewing"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Claiming prevents duplicate reviewer effort and preserves decision ownership.
      </p>
      {!owner ? (
        <button
          onClick={onClaim}
          disabled={busy}
          className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-xs font-semibold text-white"
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
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-amber-300 bg-amber-50 text-amber-700";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${active ? activeClass : "border-slate-200"}`}
    >
      <Icon className="mr-2 inline h-4 w-4" />
      {label}
    </button>
  );
}
