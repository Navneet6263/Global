import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkspaceFrame } from "@/components/shell/workspace-frame";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { getSession } from "@/lib/api/auth";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientHeaderActions } from "@/features/stakeholders/client/ClientHeaderActions";
import {
  ClientWorkspaceSearch,
  type WorkspaceDestination,
} from "@/features/stakeholders/client/ClientWorkspaceSearch";

/**
 * Shared clean workspace frame (sidebar, search header, help, learning mode and account)
 * used by RM, Data Entry and Team Leader workspaces.
 */
export function RoleWorkspaceShell({
  workspace,
  roleLabel,
  destinations,
  caseSearchTo,
  caseSearchParams,
  searchPlaceholder = "Find a case or a page",
  navigation,
  children,
}: {
  workspace: NavWorkspace;
  roleLabel: string;
  /** Page titles by path segment (kept for callers; the header now shows the workspace). */
  titles?: Record<string, string>;
  destinations: readonly WorkspaceDestination[];
  caseSearchTo: string;
  caseSearchParams?: Record<string, string>;
  searchPlaceholder?: string;
  navigation: (onNavigate?: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const presentation = WORKSPACE_PRESENTATION[workspace];
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
      <WorkspaceFrame
        className="client-portal-shell ops-portal-shell"
        mainClassName="client-main"
        home={presentation.home}
        homeSearch={caseSearchParams}
        homeLabel="Sapling Global"
        area={presentation.label}
        place={session.data?.tenantName ?? "Sapling Global"}
        navTitle={`${presentation.label} navigation`}
        navigation={navigation}
        search={
          <ClientWorkspaceSearch
            destinations={destinations}
            caseSearchTo={caseSearchTo}
            caseSearchParams={caseSearchParams}
            placeholder={searchPlaceholder}
          />
        }
        actions={
          <ClientHeaderActions
            workspace={workspace}
            roleLabel={roleLabel}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        }
      >
        <LearningIntro />
        {children}
      </WorkspaceFrame>
    </WorkspaceHelp>
  );
}
