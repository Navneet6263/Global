"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { ViewOnlyBanner } from "./view-only-banner";
import { GlobalSearch } from "./global-search";
import { QuickCreateMenu } from "./quick-create-menu";
import { WorkspaceFrame } from "./workspace-frame";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { getSession } from "@/lib/api/auth";
import { sessionForNav } from "@/lib/auth/session";
import { notifySuccess } from "@/lib/feedback/notify";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientHeaderActions } from "@/features/stakeholders/client/ClientHeaderActions";
import { ClientSupportLauncher } from "@/features/support/components/ClientSupportLauncher";

interface AdminShellProps {
  children: ReactNode;
  workspace?: NavWorkspace;
}

export function AdminShell({ children, workspace = "platform-admin" }: AdminShellProps) {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const presentation = WORKSPACE_PRESENTATION[workspace];
  const navSession = sessionForNav(workspace);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
      notifySuccess("Workspace refreshed", "Visible operational panels are up to date.");
    } catch {
      toast.error("Some panels could not refresh", {
        description: "Your existing data is kept. Retry the affected panel.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <WorkspaceHelp workspace={workspace}>
      <WorkspaceFrame
        mainClassName="min-w-0 px-4 py-5 lg:p-6"
        home={presentation.home}
        homeLabel={`Sapling Global — ${presentation.label} home`}
        area={presentation.label}
        place={session.data?.tenantName ?? navSession.scopeLabel}
        navTitle={`${presentation.label} navigation`}
        navigation={(onNavigate) => (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav workspace={workspace} onNavigate={onNavigate} />
          </div>
        )}
        search={presentation.search ? <GlobalSearch workspace={workspace} /> : undefined}
        actions={
          <ClientHeaderActions
            workspace={workspace}
            // Only the role of the workspace switched into, not every role the user holds.
            roleLabel={presentation.label}
            securityTo={presentation.security}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            extra={
              <>
                {workspace === "client-admin" ? <ClientSupportLauncher /> : null}
                {presentation.quickCreate ? <QuickCreateMenu /> : null}
              </>
            }
          />
        }
      >
        <div className="mx-auto w-full max-w-[1560px] space-y-4">
          <LearningIntro />
          <ViewOnlyBanner />
          {children}
        </div>
      </WorkspaceFrame>
    </WorkspaceHelp>
  );
}
