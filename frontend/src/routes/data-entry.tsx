import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import type { NavItem } from "@/config/navigation";
import { getSession } from "@/lib/api/auth";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { ConfigNavigation } from "@/features/workspace-shell/ConfigNavigation";
import { RoleWorkspaceShell } from "@/features/workspace-shell/RoleWorkspaceShell";

export const Route = createFileRoute("/data-entry")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["DATA_ENTRY"]),
  component: DataEntryLayout,
});

const destinations = [
  {
    label: "Dashboard",
    detail: "Your queue, work done this week and turnaround",
    to: "/data-entry/overview",
    terms: "dashboard overview work done today week month turnaround",
    permission: "case:read",
  },
  {
    label: "My reports",
    detail: "Download a custom sheet of your work",
    to: "/data-entry/reports",
    terms: "report export csv excel sheet download columns",
    permission: "case:read",
  },
  {
    label: "Intake queue",
    detail: "Review documents, request corrections, mark Ready",
    to: "/data-entry",
    terms: "intake documents correction ready insufficiency l1",
    permission: "case:read",
  },
];

const TEAM_MEMBERS: NavItem = {
  workspace: "data-entry",
  label: "Team members",
  description: "Add logins, reset passwords and suspend access",
  icon: UserCog,
  route: "/data-entry/members",
  group: "work",
  roles: ["DATA_ENTRY"],
  permission: "case:read",
};

function DataEntryLayout() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const isLead = Boolean(
    session.data?.departments?.some((d) => d.kind === "DATA_ENTRY" && d.role === "LEAD"),
  );
  return (
    <RoleWorkspaceShell
      workspace="data-entry"
      roleLabel="Data Entry"
      titles={{
        "": "Intake queue",
        overview: "Dashboard",
        reports: "My reports",
        members: "Team members",
      }}
      destinations={destinations}
      caseSearchTo="/data-entry"
      searchPlaceholder="Find a case"
      navigation={(onNavigate) => (
        <ConfigNavigation
          workspace="data-entry"
          subtitle="Intake review"
          extraItems={isLead ? [TEAM_MEMBERS] : []}
          onNavigate={onNavigate}
        />
      )}
    >
      <Outlet />
    </RoleWorkspaceShell>
  );
}
