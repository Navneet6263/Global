import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import type { VerificationTask } from "@/lib/api/tasks";
import { humanize } from "../utils";

export function CompletedTask({ task }: { task: VerificationTask }) {
  return (
    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Completed outcome:{" "}
        {humanize(task.check.result ?? "recorded")}
      </p>
      <p className="mt-2 text-sm text-slate-600">{task.check.sourceSummary}</p>
      {task.check.findings.map((item) => (
        <div key={item.publicId} className="mt-3 rounded-lg bg-white p-3 text-sm">
          <p className="font-semibold">
            {item.title} · {humanize(item.severity)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
export function WorkspaceNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <p className="text-xs font-semibold text-blue-700">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  extra = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  extra?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 ${extra}`}
    >
      {children}
    </button>
  );
}
export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

export function BlockerEditor({
  value,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-red-100 bg-red-50/60 p-4">
      <label className="text-xs font-semibold">
        Factual blocking reason
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-red-100 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onSave} disabled={busy || value.trim().length < 3}>
          Record blocker
        </PrimaryButton>
      </div>
    </div>
  );
}
