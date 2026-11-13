import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkspaceFrame } from "@/components/shell/workspace-frame";
import { getSession } from "@/lib/api/auth";
import { ClientWorkspaceSearch } from "./ClientWorkspaceSearch";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientPortalNavigation } from "./ClientPortalNavigation";
import { ClientHeaderActions } from "./ClientHeaderActions";

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
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
    <WorkspaceHelp workspace="client-admin">
      <WorkspaceFrame
        className="client-portal-shell"
        mainClassName="client-main"
        home="/client-portal"
        homeLabel="Sapling Global client portal"
        area="Client workspace"
        place={session.data?.clientName ?? "Your organisation"}
        navTitle="Client portal navigation"
        navigation={(onNavigate) => <ClientPortalNavigation onNavigate={onNavigate} />}
        search={<ClientWorkspaceSearch />}
        actions={<ClientHeaderActions refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <LearningIntro />
        {children}
      </WorkspaceFrame>
    </WorkspaceHelp>
  );
}
