import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import { WorkspaceFrame } from "@/components/shell/workspace-frame";
import { getSession } from "@/lib/api/auth";
import { ClientWorkspaceSearch } from "./ClientWorkspaceSearch";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientPortalNavigation } from "./ClientPortalNavigation";
import { ClientHeaderActions } from "./ClientHeaderActions";
import { ThemeToggle } from "@/kit";
import { ClientNewVerification } from "./ClientWorkspaceHeader";

const PAGES: Record<string, string> = {
  "/client-portal": "Overview",
  "/client-portal/verifications": "All candidates",
  "/client-portal/pipeline": "Pipeline",
  "/client-portal/actions": "Your to-do",
  "/client-portal/review": "Review submissions",
  "/client-portal/reports": "Final reports",
  "/client-portal/analytics": "Insights",
  "/client-portal/billing": "Invoices & payments",
  "/client-portal/support": "Queries & support",
  "/client-portal/onboarding": "Get started",
};
const VIEWS: Record<string, string> = {
  mis: "MIS & Excel",
  custom: "Custom export",
  invoices: "Invoices & statements",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  PAYMENT_PENDING: "Awaiting release",
};

/** The page name shown in the header breadcrumb. */
function usePageName() {
  return useLocation({
    select: (location) => {
      const path = location.pathname.replace(/\/$/, "") || "/client-portal";
      const search = location.search as Record<string, unknown>;
      const view = String(search["view"] ?? search["status"] ?? "");
      return (path !== "/client-portal" && VIEWS[view]) || PAGES[path] || "Client workspace";
    },
  });
}

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const pageName = usePageName();
  // Sky theme on <html>, so dialogs and menus that open outside the page match it too.
  useEffect(() => {
    document.documentElement.classList.add("theme-sky");
    return () => document.documentElement.classList.remove("theme-sky");
  }, []);
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
        className="lg:min-h-[calc(100dvh/0.9)]"
        mainClassName="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 sm:p-6"
        home="/client-portal"
        homeLabel="Sapling Global client portal"
        area={pageName}
        place={session.data?.clientName ?? "Your organisation"}
        navTitle="Client portal navigation"
        collapsible
        navigation={(onNavigate, collapsed) => (
          <ClientPortalNavigation onNavigate={onNavigate} collapsed={collapsed} />
        )}
        search={
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ClientWorkspaceSearch />
            </div>
            <ClientNewVerification compact />
          </div>
        }
        actions={
          <ClientHeaderActions
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tools={<ThemeToggle />}
          />
        }
      >
        <LearningIntro />
        {children}
      </WorkspaceFrame>
    </WorkspaceHelp>
  );
}
