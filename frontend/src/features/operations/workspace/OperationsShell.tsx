import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";
import { ClientHeaderActions } from "@/features/stakeholders/client/ClientHeaderActions";
import {
  ClientWorkspaceSearch,
  type WorkspaceDestination,
} from "@/features/stakeholders/client/ClientWorkspaceSearch";
import { OperationsNavigation } from "./OperationsNavigation";

const destinations: readonly WorkspaceDestination[] = [
  {
    label: "Operations overview",
    detail: "Work queue, owners and next actions",
    to: "/operations",
    terms: "dashboard home queue",
    permission: "dashboard:read",
  },
  {
    label: "Awaiting RM",
    detail: "Live cases without a responsible RM",
    to: "/operations",
    search: { view: "needs-rm" },
    terms: "assign rm spoc owner unassigned",
    permission: "case:read",
  },
  {
    label: "Needs attention",
    detail: "Documents, starts, allocation and replies",
    to: "/operations/attention",
    terms: "action inbox pending review documents",
    permission: "case:read",
  },
  {
    label: "All cases",
    detail: "Case 360 register with every case",
    to: "/operations/cases",
    terms: "register case 360 search",
    permission: "case:read",
  },
  {
    label: "Corrections & queries",
    detail: "Candidate and client follow-ups",
    to: "/operations/clarifications",
    terms: "clarification insufficiency correction",
    permission: "clarification:read",
  },
  {
    label: "SLA monitor",
    detail: "Breach risk and ageing",
    to: "/operations/sla",
    terms: "overdue tat due breach",
    permission: "dashboard:read",
  },
  {
    label: "Exceptions",
    detail: "Blocked, breached and returned work",
    to: "/operations/exceptions",
    terms: "escalation blocked",
    permission: "case:transition",
  },
  {
    label: "Reports & MIS",
    detail: "Custom Excel/CSV reports and MIS pack",
    to: "/operations/reports",
    terms: "report export excel csv mis tat utv discrepancy download",
    permission: "case:read",
  },
  {
    label: "New sign-ups",
    detail: "Self-registered companies: review documents and approve",
    to: "/operations/onboarding",
    terms: "signup sign-up register onboarding new company approve kyc agreement",
    permission: "client:read",
  },
  {
    label: "Packages & pricing",
    detail: "Build packages, RM discount limits and client discounts",
    to: "/operations/packages",
    terms: "package price pricing discount rate tariff rm limit",
    permission: "case:read",
  },
  {
    label: "Companies & RMs",
    detail: "Assign one RM per company; cases follow automatically",
    to: "/operations/clients",
    terms: "company client rm spoc assign bulk",
    permission: "client:read",
  },
  {
    label: "Departments & teams",
    detail: "Data Entry and verification teams, Team Leaders",
    to: "/operations/departments",
    terms: "department team leader tl member data entry employment education address",
    permission: "user:read",
  },
  {
    label: "UTV bucket",
    detail: "Unable-to-verify checks to re-open or re-initiate",
    to: "/operations/utv",
    terms: "utv unable to verify reopen re-open reinitiate insufficient",
    permission: "case:read",
  },
  {
    label: "Vendor work",
    detail: "Checks sent to vendors: ageing, overdue and results to review",
    to: "/operations/vendor-work",
    terms: "vendor field outsource address court drug visit ageing",
    permission: "case:read",
  },
  {
    label: "Team annexure",
    detail: "Weekly, monthly and yearly closed checks with colour codes",
    to: "/operations/annexure",
    terms: "annexure team leader weekly monthly yearly colour code reject send back",
    permission: "case:read",
  },
  {
    label: "Team & user IDs",
    detail: "Who is loaded, who has room, and create user IDs",
    to: "/operations/team",
    terms: "workload capacity people team user id create login account rm data entry verifier",
    permission: "user:read",
  },
];

const titles: Record<string, string> = {
  attention: "Needs attention",
  onboarding: "New sign-ups",
  packages: "Packages & pricing",
  utv: "UTV bucket",
  annexure: "Team annexure",
  "vendor-work": "Vendor work",
  cases: "All cases",
  clarifications: "Corrections & queries",
  team: "Team",
  assignments: "Override allocation",
  sla: "SLA monitor",
  exceptions: "Exceptions",
  field: "Field operations",
  reports: "Reports & MIS",
  departments: "Departments & teams",
  clients: "Companies & RMs",
};

export function OperationsShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const path = useLocation({ select: (location) => location.pathname });
  const section = path.startsWith("/cases/")
    ? "Case"
    : (titles[path.split("/")[2] ?? ""] ?? "Overview");
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
    <WorkspaceHelp workspace="operations">
      <div className="client-portal-shell ops-portal-shell">
        <a href="#workspace-main" className="client-skip-link">
          Skip to main content
        </a>
        <aside className="client-sidebar">
          <OperationsNavigation />
        </aside>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="client-mobile-nav w-[288px] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Operations navigation</SheetTitle>
            </SheetHeader>
            <OperationsNavigation onNavigate={() => setOpen(false)} />
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
                <Link to="/operations">Operations</Link>
                <span aria-hidden>/</span>
                <strong>{section}</strong>
              </div>
            </div>
            <div className="client-global-search">
              <ClientWorkspaceSearch
                destinations={destinations}
                caseSearchTo="/operations"
                placeholder="Find case, candidate, client or RM"
              />
            </div>
            <ClientHeaderActions
              workspace="operations"
              roleLabel="Operations Manager"
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
