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
    <div className="grid grid-cols-4 border-y border-white/70 bg-secondary/45 px-2 py-3.5">
      {steps.map(({ number, label, done }, index) => (
        <div key={label} className="relative text-center">
          {index ? (
            <span
              aria-hidden
              className={`absolute right-1/2 top-3 h-px w-full ${steps[index - 1]?.done ? "bg-success/45" : "bg-border"}`}
            />
          ) : null}
          <span
            className={`relative z-10 mx-auto grid size-6 place-items-center rounded-full border text-[9px] font-semibold shadow-sm ${done ? "border-success bg-success text-white" : "border-white bg-white text-muted-foreground"}`}
          >
            {done ? <Check className="h-3 w-3" /> : number}
          </span>
          <p
            className={`mt-1.5 text-[9px] ${done ? "font-medium text-success-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function FieldVisitStatus({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "bg-success-soft text-success-foreground"
      : status === "EXCEPTION_REVIEW"
        ? "bg-warning-soft text-warning-foreground"
        : "bg-info-soft text-info-foreground";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${tone}`}>
      {status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (value) => value.toUpperCase())}
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
  const classes = `flex h-11 items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all ${primary ? "bg-mint-deep text-white shadow-[var(--shadow-card)] hover:-translate-y-0.5" : "border border-white/80 bg-white/85 text-foreground shadow-[var(--shadow-card)] hover:bg-white"} disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0`;
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
