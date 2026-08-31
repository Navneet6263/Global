import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Laptop, MapPin, Pencil, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { renameActiveSession, type ActiveSession } from "@/lib/api/auth";
import { StakeholderPanel } from "../StakeholderShell";

type Props = {
  items: ActiveSession[];
  loading: boolean;
  revokingId?: string | undefined;
  revokingOthers: boolean;
  onRevoke: (id: string) => void;
  onRevokeOthers: () => void;
};
export function SecuritySessions({
  items,
  loading,
  revokingId,
  revokingOthers,
  onRevoke,
  onRevokeOthers,
}: Props) {
  const queryClient = useQueryClient();
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameActiveSession(id, name),
    onSuccess: () => {
      toast.success("Device name updated");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "security-events"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <StakeholderPanel
      title="Active sessions"
      detail="Devices currently authorised to use this account"
      action={
        items.length > 1 ? (
          <button
            type="button"
            onClick={onRevokeOthers}
            disabled={revokingOthers}
            className="h-9 rounded-xl border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Revoke all others
          </button>
        ) : undefined
      }
    >
      <div className="p-4">
        {loading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : null}
        {!loading && items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <SessionRow
                key={item.id}
                item={item}
                revoking={revokingId === item.id}
                renaming={rename.isPending && rename.variables?.id === item.id}
                onRename={(name) => rename.mutate({ id: item.id, name })}
                onRevoke={() => onRevoke(item.id)}
              />
            ))}
          </div>
        ) : null}
        {!loading && !items.length ? (
          <p className="py-12 text-center text-sm text-slate-500">No active sessions returned.</p>
        ) : null}
      </div>
    </StakeholderPanel>
  );
}
function SessionRow({
  item,
  revoking,
  renaming,
  onRevoke,
  onRename,
}: {
  item: ActiveSession;
  revoking: boolean;
  renaming: boolean;
  onRevoke: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.deviceName ?? "");
  const device = describeDevice(item.userAgent);
  const Icon = device.mobile ? Smartphone : Laptop;
  return (
    <article
      className={`flex items-start gap-3 rounded-2xl border p-4 ${item.current ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={device.label}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
              />
              <button
                type="button"
                disabled={name.trim().length < 2 || renaming}
                onClick={() => {
                  onRename(name.trim());
                  setEditing(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold">{item.deviceName || device.label}</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Rename device"
                className="text-slate-400 hover:text-slate-700"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
          {item.current ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
              Current session
            </span>
          ) : null}
        </div>
        {item.deviceName ? (
          <p className="mt-0.5 text-[10px] text-slate-400">{device.label}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.locationLabel ?? "Location unavailable"} · {item.ipAddress ?? "IP unavailable"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            Signed in {formatDate(item.createdAt)}
          </span>
        </div>
        <p className="mt-1 truncate text-[10px] text-slate-400" title={item.userAgent ?? undefined}>
          Expires {formatDate(item.expiresAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={revoking}
        aria-label={`${item.current ? "Sign out current" : "Revoke"} session on ${device.label}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}
function describeDevice(userAgent?: string | null) {
  const value = userAgent ?? "";
  const mobile = /Android|iPhone|iPad/i.test(value);
  const platform = /iPhone|iPad/i.test(value)
    ? "iOS"
    : /Android/i.test(value)
      ? "Android"
      : /Windows/i.test(value)
        ? "Windows"
        : /Mac OS/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /Firefox\//i.test(value)
      ? "Firefox"
      : /Chrome\//i.test(value)
        ? "Chrome"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  return { mobile, label: `${browser} on ${platform}` };
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
