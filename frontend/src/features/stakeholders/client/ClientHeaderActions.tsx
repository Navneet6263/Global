import type { ReactNode } from "react";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { RefreshCw } from "lucide-react";
import { Button } from "@/kit";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { HelpMenu } from "@/features/help/help-launcher";
import type { NavWorkspace } from "@/config/navigation";
import { ClientAccountMenu } from "./ClientAccountMenu";

export function ClientHeaderActions({
  refreshing,
  onRefresh,
  workspace = "client-admin",
  roleLabel,
  securityTo,
  extra,
  tools,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  workspace?: NavWorkspace;
  roleLabel?: string;
  /** Where "Account security" opens; every workspace but Admin uses /change-password. */
  securityTo?: string;
  /** Workspace-only tools (e.g. support or quick create), shown before help. */
  extra?: ReactNode;
  /** Small icon tools shown inside the icon pill (e.g. the theme switch). */
  tools?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 md:gap-2" aria-label="Workspace tools">
      <div className="flex items-center gap-0.5">
        <NotificationsMenu workspace={workspace} />
        <Button
          variant="ghost"
          size="icon"
          className="max-md:size-10"
          aria-label="Refresh workspace data"
          loading={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden />
        </Button>
        {tools}
      </div>
      {extra}
      <HelpMenu />
      <RoleSwitcher />
      <ClientAccountMenu roleLabel={roleLabel} securityTo={securityTo} />
    </div>
  );
}
