import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { ORGANISATION } from "@/config/workspaces";
import type { NavWorkspace } from "@/config/navigation";

const WORKSPACE_LABEL: Record<NavWorkspace, string> = {
  "platform-admin": "Platform Admin",
  operations: "Operations Manager",
  "sales-crm": "Sales & CRM",
};

export function BrandMark({ workspace = "platform-admin" }: { workspace?: NavWorkspace }) {
  const home =
    workspace === "operations"
      ? "/operations"
      : workspace === "sales-crm"
        ? "/sales-crm"
        : "/admin";
  const label = WORKSPACE_LABEL[workspace];

  return (
    <Link
      to={home as "/admin"}
      className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition-opacity hover:opacity-90"
      aria-label={`${ORGANISATION.name} — ${label} home`}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
        <Sprout className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
          {ORGANISATION.name}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {label} · {ORGANISATION.timezoneLabel}
        </span>
      </span>
    </Link>
  );
}
