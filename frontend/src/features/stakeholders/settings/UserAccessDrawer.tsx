import { useQuery } from "@tanstack/react-query";
import { Clock3, ShieldCheck, X } from "lucide-react";

import { getUserActivity, type DirectoryRole, type DirectoryUser } from "@/lib/api/users";

export function UserAccessDrawer({
  user,
  roles,
  onClose,
}: {
  user: DirectoryUser;
  roles: DirectoryRole[];
  onClose: () => void;
}) {
  const activity = useQuery({
    queryKey: ["users", user.id, "activity"],
    queryFn: () => getUserActivity(user.id),
  });
  const assigned = roles.filter((role) => user.roles.some((item) => item.code === role.code));
  const permissions = [...new Set(assigned.flatMap((role) => role.permissions))];
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close user detail"
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Access record
            </p>
            <h2 className="mt-1 text-lg font-semibold">{user.displayName}</h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <Fact label="Status" value={humanize(user.status)} />
            <Fact
              label="Scope"
              value={user.client?.displayName ?? user.branch?.name ?? "Tenant-wide"}
            />
            <Fact
              label="Last login"
              value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
            />
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Assigned roles" detail={`${assigned.length} access roles`} />
            <div className="space-y-2 p-4">
              {assigned.map((role) => (
                <div key={role.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold">{role.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{role.code}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading
              title="Effective permissions"
              detail="Union of all assigned role permissions"
            />
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto p-4">
              {permissions.includes("*") ? (
                <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                  Full platform access
                </span>
              ) : (
                permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600"
                  >
                    {permission}
                  </span>
                ))
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading
              title="Security & access history"
              detail="Latest immutable events for this account"
            />
            <div className="divide-y divide-slate-100">
              {activity.data?.items.map((event) => (
                <div key={event.id} className="flex gap-3 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{humanize(event.action)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {formatDate(event.createdAt)} · {event.actor?.displayName ?? "System"}
                      {event.ipAddress ? ` · ${event.ipAddress}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {activity.isLoading ? (
                <div className="m-4 h-24 animate-pulse rounded-xl bg-slate-100" />
              ) : null}
              {!activity.isLoading && !activity.data?.items.length ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No access events recorded yet.
                </p>
              ) : null}
            </div>
          </section>
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[10px] leading-4">
              Self-suspension and removal of the final active Platform Admin are blocked by the
              backend.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="border-b border-slate-200 px-4 py-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
