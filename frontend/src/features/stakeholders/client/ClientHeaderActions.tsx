import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { HelpLauncher } from "@/features/help/help-launcher";
import { usePageHelp } from "@/features/help/help-state";
import { ClientAccountMenu } from "./ClientAccountMenu";

export function ClientHeaderActions({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const help = usePageHelp();
  return (
    <div className="client-header-actions" aria-label="Workspace tools">
      <div className="client-header-shortcuts">
        <NotificationsMenu workspace="client-admin" />
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
      <HelpLauncher label="Help & learning" className="client-header-help" />
      {help ? (
        <button
          type="button"
          className="client-learning-control"
          role="switch"
          aria-label="Learning mode"
          aria-checked={help.enabled}
          onClick={() => help.setEnabled(!help.enabled)}
          title="Show guidance as you use each page"
        >
          <BookOpen aria-hidden />
          <span className="client-learning-label">Learning mode</span>
          <span className="client-learning-switch" data-enabled={help.enabled} aria-hidden />
        </button>
      ) : null}
      <ClientAccountMenu />
    </div>
  );
}
