import { RoleSwitcher } from "@/components/shell/role-switcher";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { HelpMenu } from "@/features/help/help-launcher";
import type { NavWorkspace } from "@/config/navigation";
import { ClientAccountMenu } from "./ClientAccountMenu";

export function ClientHeaderActions({
  refreshing,
  onRefresh,
  workspace = "client-admin",
  roleLabel,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  workspace?: NavWorkspace;
  roleLabel?: string;
}) {
  return (
    <div className="client-header-actions" aria-label="Workspace tools">
      <div className="client-header-shortcuts">
        <NotificationsMenu workspace={workspace} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh workspace data"
          loading={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden />
        </Button>
      </div>
      <HelpMenu />
      <RoleSwitcher />
      <ClientAccountMenu roleLabel={roleLabel} />
    </div>
  );
}
