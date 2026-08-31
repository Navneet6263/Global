import { Link } from "@tanstack/react-router";
import { SaplingSymbol } from "@/components/brand/sapling-symbol";
import { ORGANISATION } from "@/config/workspaces";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

export function BrandMark({ workspace = "platform-admin" }: { workspace?: NavWorkspace }) {
  const presentation = WORKSPACE_PRESENTATION[workspace];

  return (
    <Link
      to={presentation.home as "/admin"}
      className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition-opacity hover:opacity-90"
      aria-label={`${ORGANISATION.name} — ${presentation.label} home`}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#fff9f3] ring-1 ring-primary/15">
        <SaplingSymbol className="size-8" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
          {ORGANISATION.name}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {presentation.label} · {ORGANISATION.timezoneLabel}
        </span>
      </span>
    </Link>
  );
}
