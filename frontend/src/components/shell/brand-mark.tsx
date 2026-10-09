import { Link } from "@tanstack/react-router";
import { SaplingLogo } from "@/components/brand/sapling-logo";
import { ORGANISATION } from "@/config/workspaces";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

export function BrandMark({ workspace = "platform-admin" }: { workspace?: NavWorkspace }) {
  const presentation = WORKSPACE_PRESENTATION[workspace];

  return (
    <Link
      to={presentation.home as "/admin"}
      className="flex flex-col items-start gap-1 rounded-xl px-1 py-1 transition-opacity hover:opacity-90"
      aria-label={`${ORGANISATION.name} — ${presentation.label} home`}
    >
      <SaplingLogo width={150} />
      <span className="block truncate pl-0.5 text-[11px] text-muted-foreground">
        {presentation.label} · {ORGANISATION.timezoneLabel}
      </span>
    </Link>
  );
}
