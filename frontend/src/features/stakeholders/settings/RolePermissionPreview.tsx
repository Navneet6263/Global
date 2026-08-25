import { ShieldCheck } from "lucide-react";

import type { DirectoryRole } from "@/lib/api/users";

export function RolePermissionPreview({ roles }: { roles: DirectoryRole[] }) {
  if (!roles.length) return null;
  const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
  const fullAccess = permissions.includes("*");
  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold">Access preview</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Combined permissions granted by the selected roles
          </p>
        </div>
      </div>
      {fullAccess ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-semibold text-violet-700">
          Full platform access — every current and future workspace permission
        </p>
      ) : (
        <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {permissions.map((permission) => (
            <span
              key={permission}
              className="rounded-lg bg-secondary px-2 py-1 text-[9px] font-semibold text-muted-foreground"
            >
              {humanize(permission)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
function humanize(value: string) {
  return value
    .replaceAll(":", " · ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
