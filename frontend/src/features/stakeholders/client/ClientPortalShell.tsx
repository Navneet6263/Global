import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/shell/global-search";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientPortalNavigation } from "./ClientPortalNavigation";
import { ClientHeaderActions } from "./ClientHeaderActions";

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
      toast.success("Workspace refreshed");
    } catch {
      toast.error("Some panels could not refresh. Retry the affected panel.");
    } finally {
      setRefreshing(false);
    }
  };
  const path = useLocation({ select: (location) => location.pathname });
  const page = path.split("/")[2];
  const title =
    (
      {
        actions: "Needs your action",
        analytics: "Insights",
        billing: "Invoices & payments",
        reports: "Reports",
        verifications: "Verifications",
      } as Record<string, string>
    )[page ?? ""] ?? "Overview";
  return (
    <WorkspaceHelp workspace="client-admin">
      <div className="client-portal-shell">
        <a href="#workspace-main" className="client-skip-link">
          Skip to main content
        </a>
        <aside className="client-sidebar">
          <ClientPortalNavigation />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="client-mobile-nav w-[288px] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Client portal navigation</SheetTitle>
            </SheetHeader>
            <ClientPortalNavigation onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="client-page">
          <header className="client-topbar">
            <div className="client-location">
              <Button
                variant="ghost"
                size="icon"
                className="client-menu-toggle"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
              >
                <Menu aria-hidden />
              </Button>
              <div className="client-breadcrumb">
                <Link to="/client-portal">Client portal</Link>
                <span aria-hidden>/</span>
                <strong>{title}</strong>
              </div>
            </div>
            <div className="client-global-search">
              <GlobalSearch workspace="client-admin" />
            </div>
            <ClientHeaderActions refreshing={refreshing} onRefresh={() => void refresh()} />
          </header>
          <main id="workspace-main" className="client-main">
            <LearningIntro />
            {children}
          </main>
        </div>
      </div>
    </WorkspaceHelp>
  );
}
