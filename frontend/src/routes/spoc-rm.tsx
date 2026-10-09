import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { ConfigNavigation } from "@/features/workspace-shell/ConfigNavigation";
import { RoleWorkspaceShell } from "@/features/workspace-shell/RoleWorkspaceShell";

export const Route = createFileRoute("/spoc-rm")({
  ssr: false,
  // RM workspace: monitoring via /spoc, owned-case actions via /workflow.
  beforeLoad: () => requireRoleWorkspace(["SPOC_RM", "PLATFORM_ADMIN"]),
  component: SpocLayout,
});

const destinations = [
  {
    label: "My work overview",
    detail: "Your numbers, cases by step and the action queue",
    to: "/spoc-rm/work",
    terms: "assign data entry route checks final approval ready correction",
    permission: "case:read",
  },
  {
    label: "Onboarding companies",
    detail: "New sign-ups you help to go live",
    to: "/spoc-rm/onboarding",
    terms: "onboarding signup sign-up new company kyc documents",
    permission: "case:read",
  },
  {
    label: "Client pricing",
    detail: "Discounts for your clients, within the package limit",
    to: "/spoc-rm/pricing",
    terms: "price pricing discount package rate",
    permission: "case:read",
  },
  {
    label: "Monitoring overview",
    detail: "Work, stages and exceptions across roles",
    to: "/spoc-rm",
    terms: "overview dashboard monitoring",
    permission: "dashboard:read",
  },
  {
    label: "Records",
    detail: "Cases, tasks, QA, pipeline and invoices",
    to: "/spoc-rm/records",
    terms: "records register",
    permission: "dashboard:read",
  },
  {
    label: "Vendors",
    detail: "Assign client documents to vendors and track decisions",
    to: "/spoc-rm/vendors",
    terms: "vendor assign document review",
    permission: "vendor:assign",
  },
  {
    label: "Clients",
    detail: "Per-client progress and receivables",
    to: "/spoc-rm/clients",
    terms: "client account",
    permission: "dashboard:read",
  },
];

function SpocLayout() {
  return (
    <RoleWorkspaceShell
      workspace="spoc-rm"
      roleLabel="Relationship Manager"
      titles={{
        "": "Monitoring overview",
        work: "My work overview",
        onboarding: "Onboarding companies",
        pricing: "Client pricing",
        records: "Records",
        clients: "My clients",
        vendors: "Vendors",
      }}
      destinations={destinations}
      caseSearchTo="/spoc-rm/work"
      searchPlaceholder="Find a case, client or page"
      navigation={(onNavigate) => (
        <ConfigNavigation
          workspace="spoc-rm"
          subtitle="Client delivery"

          onNavigate={onNavigate}
        />
      )}
    >
      <Outlet />
    </RoleWorkspaceShell>
  );
}
