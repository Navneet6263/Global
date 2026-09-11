import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import type { VerificationTask } from "@/lib/api/tasks";
import { humanize } from "../utils";

export function CompletedTask({ task }: { task: VerificationTask }) {
  return (
    <div className="mt-5 rounded-[1.3rem] border border-success/20 bg-success-soft/65 p-4">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-success-foreground">
        <CheckCircle2 className="h-4 w-4" /> Completed outcome:{" "}
        {humanize(task.check.result ?? "recorded")}
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {task.check.sourceSummary}
      </p>
      {task.check.findings.map((item) => (
        <div
          key={item.publicId}
          className="mt-3 rounded-[1rem] border border-white/80 bg-white/75 p-3 shadow-[var(--shadow-card)]"
        >
          <p className="text-[11px] font-semibold">
            {item.title} · {humanize(item.severity)}
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/80 bg-background/55 p-3 shadow-[var(--shadow-card)]">
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-[12px] font-medium">{value}</p>
    </div>
  );
}
export function WorkspaceNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-4 rounded-[1.2rem] border border-info/20 bg-info-soft/55 p-4">
      <p className="text-[11px] font-semibold text-info-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading = false,
  type = "button",
  extra = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  extra?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center gap-2 rounded-full bg-mint-deep px-4 py-2.5 text-[11px] font-medium text-white shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 ${extra}`}
    >
      {children}
    </button>
  );
}
export function SecondaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2.5 text-[11px] font-medium transition hover:bg-mint-soft"
    >
      {children}
    </button>
  );
}

export function BlockerEditor({
  value,
  busy,
  loading,
  onChange,
  onClose,
  onSave,
}: {
  value: string;
  busy: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 rounded-[1.25rem] border border-critical/20 bg-critical-soft/65 p-4">
      <label className="text-[11px] font-semibold">
        Factual blocking reason
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-[1rem] border border-critical/20 bg-white/85 px-3 py-2.5 text-[12px] outline-none focus:border-critical/45"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <SecondaryButton disabled={busy} onClick={onClose}>
          Cancel
        </SecondaryButton>
        <PrimaryButton
          onClick={onSave}
          disabled={busy || value.trim().length < 3}
          loading={loading}
        >
          Record blocker
        </PrimaryButton>
      </div>
    </div>
  );
}
