import { Check, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StepId } from "./verification-readiness";

export interface StepItem {
  id: StepId;
  label: string;
  hint: string;
  done: boolean;
  icon: LucideIcon;
}

/** Numbered progress steps; a finished step shows a tick. */
export function StepNav({
  steps,
  current,
  onSelect,
}: {
  steps: StepItem[];
  current: StepId;
  onSelect: (id: StepId) => void;
}) {
  const done = steps.filter((step) => step.done).length;
  return (
    <nav aria-label="Steps to complete this check" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-slate-900">Steps to complete this check</p>
        <span className="text-[12px] font-medium text-slate-500">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const active = step.id === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className={cn(
                  "flex h-full w-full items-start gap-2.5 rounded-xl border p-3 text-left transition",
                  active
                    ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-500/15"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                    step.done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {step.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-slate-900">
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[11.5px]",
                      step.done ? "text-emerald-700" : "text-slate-500",
                    )}
                  >
                    {step.done ? "Done" : step.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Heading of a step: what to do and why. */
export function StepIntro({
  number,
  title,
  children,
  aside,
}: {
  number: number;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          Step {number}
        </p>
        <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{children}</div>
      </div>
      {aside}
    </div>
  );
}

/** Final check before completing: every requirement with a way to fix it. */
export function ReviewChecklist({
  items,
  onFix,
}: {
  items: Array<{ id: StepId; label: string; done: boolean; detail: string }>;
  onFix: (id: StepId) => void;
}) {
  return (
    <ul aria-label="Before you complete" className="grid gap-2">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3",
            item.done ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60",
          )}
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full",
              item.done ? "bg-emerald-500 text-white" : "bg-amber-400 text-white",
            )}
          >
            {item.done ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-900">{item.label}</span>
            <span className="block text-[12px] text-slate-600">{item.detail}</span>
          </span>
          {!item.done ? (
            <button
              type="button"
              onClick={() => onFix(item.id)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go to step
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
