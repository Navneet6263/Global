import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientHeaderActions } from "@/features/stakeholders/client/ClientHeaderActions";
import {
  ClientWorkspaceSearch,
  type WorkspaceDestination,
} from "@/features/stakeholders/client/ClientWorkspaceSearch";

/**
 * Shared clean workspace frame (sidebar, search header, help, learning mode and account)
 * used by Operations, RM, Data Entry and Team Leader workspaces.
 */
export function RoleWorkspaceShell({
  workspace,
  roleLabel,
  titles,
  destinations,
  caseSearchTo,
  searchPlaceholder = "Find a case or a page",
  navigation,
  children,
}: {
  workspace: NavWorkspace;
  roleLabel: string;
  /** Breadcrumb title by the path segment after the workspace root. */
  titles: Record<string, string>;
  destinations: readonly WorkspaceDestination[];
  caseSearchTo: string;
  searchPlaceholder?: string;
  navigation: (onNavigate?: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const presentation = WORKSPACE_PRESENTATION[workspace];
  const path = useLocation({ select: (location) => location.pathname });
  const section = path.startsWith("/cases/")
    ? "Case"
    : (titles[path.split("/")[2] ?? ""] ?? titles[""] ?? "Overview");
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
  return (
    <WorkspaceHelp workspace={workspace}>
      {/* ops-portal-shell is the shared hook for the clean workspace styling. */}
      <div className="client-portal-shell ops-portal-shell">
        <a href="#workspace-main" className="client-skip-link">
          Skip to main content
        </a>
        <aside className="client-sidebar">{navigation()}</aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="client-mobile-nav w-[288px] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{presentation.label} navigation</SheetTitle>
            </SheetHeader>
            {navigation(() => setOpen(false))}
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
                <Link to={presentation.home as "/admin"}>{presentation.label}</Link>
                <span aria-hidden>/</span>
                <strong>{section}</strong>
              </div>
            </div>
            <div className="client-global-search">
              <ClientWorkspaceSearch
                destinations={destinations}
                caseSearchTo={caseSearchTo}
                placeholder={searchPlaceholder}
              />
            </div>
            <ClientHeaderActions
              workspace={workspace}
              roleLabel={roleLabel}
              refreshing={refreshing}
              onRefresh={() => void refresh()}
            />
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
