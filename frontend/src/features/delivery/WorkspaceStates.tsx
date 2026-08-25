import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";

export function WorkspaceLoading({ label = "Loading live workspace" }: { label?: string }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-slate-50/60">
      <div className="text-center text-sm text-slate-500">
        <LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center">
      <AlertTriangle className="mx-auto h-5 w-5 text-red-600" />
      <p className="mt-2 text-sm font-semibold text-slate-900">Workspace could not be loaded</p>
      <p className="mt-1 text-xs text-slate-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}

export function WorkspaceEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
      <div>
        <Inbox className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
