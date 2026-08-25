import { Check, Clock3 } from "lucide-react";

export function FieldStepStrip({
  checkedIn,
  photoReady,
  checklistReady,
  complete,
}: {
  checkedIn: boolean;
  photoReady: boolean;
  checklistReady: boolean;
  complete: boolean;
}) {
  const steps = [
    { number: "1", label: "Arrive", done: checkedIn },
    { number: "2", label: "Evidence", done: photoReady },
    { number: "3", label: "Checklist", done: checklistReady },
    { number: "4", label: "Complete", done: complete },
  ];
  return (
    <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 px-2 py-3">
      {steps.map(({ number, label, done }) => (
        <div key={label} className="text-center">
          <span
            className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold ${done ? "bg-emerald-600 text-white" : "bg-white text-slate-400"}`}
          >
            {done ? <Check className="h-3 w-3" /> : number}
          </span>
          <p className="mt-1 text-[9px] text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function FieldVisitStatus({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "EXCEPTION_REVIEW"
        ? "bg-amber-100 text-amber-700"
        : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${tone}`}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

export function FieldControl({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
  href,
}: {
  icon: typeof Clock3;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  href?: string | undefined;
}) {
  const classes = `flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold ${primary ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed disabled:opacity-35`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={classes}>
      <Icon className="h-4 w-4" />
      {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
