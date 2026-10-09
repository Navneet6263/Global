import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, UserCog, UsersRound } from "lucide-react";
import type { NavItem } from "@/config/navigation";
import { getSession } from "@/lib/api/auth";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { ConfigNavigation } from "@/features/workspace-shell/ConfigNavigation";
import { RoleWorkspaceShell } from "@/features/workspace-shell/RoleWorkspaceShell";

export const Route = createFileRoute("/verifier")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["VERIFIER"]),
  component: VerifierLayout,
});

const TEAM_QUEUE: NavItem = {
  workspace: "verifier",
  label: "Team queue",
  description: "Routed checks of your department; assign team members",
  icon: UsersRound,
  route: "/verifier/team",
  group: "delivery",
  roles: ["VERIFIER"],
  permission: "task:read",
};

const TEAM_ANNEXURE: NavItem = {
  workspace: "verifier",
  label: "Team annexure",
  description: "Weekly, monthly and yearly closed checks; send back for rework",
  icon: FileSpreadsheet,
  route: "/verifier/annexure",
  group: "delivery",
  roles: ["VERIFIER"],
  permission: "task:read",
};

const TEAM_MEMBERS: NavItem = {
  workspace: "verifier",
  label: "Team members",
  description: "Add logins, reset passwords and suspend access",
  icon: UserCog,
  route: "/verifier/members",
  group: "delivery",
  roles: ["VERIFIER"],
  permission: "task:read",
};

const destinations = [
  {
    label: "Verifier overview",
    detail: "Today’s workload",
    to: "/verifier",
    terms: "home overview",
    permission: "task:read",
  },
  {
    label: "Active queue",
    detail: "Your assigned checks",
    to: "/verifier/queue",
    terms: "checks tasks mine",
    permission: "task:read",
  },
  {
    label: "SLA & priorities",
    detail: "Due soon and overdue",
    to: "/verifier/sla",
    terms: "overdue due",
    permission: "task:read",
  },
  {
    label: "Blockers & clarifications",
    detail: "Blocked work and L2 insufficiency",
    to: "/verifier/blockers",
    terms: "blocked insufficiency l2 clarification",
    permission: "task:read",
  },
  {
    label: "Completed checks",
    detail: "Outcome history",
    to: "/verifier/history",
    terms: "history completed",
    permission: "task:read",
  },
];

function VerifierLayout() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const isLead = Boolean(
    session.data?.departments?.some((d) => d.kind === "VERIFICATION" && d.role === "LEAD"),
  );
  const team = session.data?.departments?.find((d) => d.kind === "VERIFICATION");
  return (
    <RoleWorkspaceShell
      workspace="verifier"
      roleLabel={isLead ? "Team Leader" : "Verifier"}
      titles={{
        "": "Overview",
        queue: "Active queue",
        sla: "SLA & priorities",
        blockers: "Blockers",
        history: "Completed checks",
        performance: "My performance",
        team: "Team queue",
        utv: "UTV bucket",
        annexure: "Team annexure",
        members: "Team members",
      }}
      destinations={
        isLead
          ? [
              {
                label: "Team members",
                detail: "Add a login for your team",
                to: "/verifier/members",
                terms: "team member user id login create add password suspend",
                permission: "task:read",
              },
              {
                label: "Team queue",
                detail: "Assign routed checks",
                to: "/verifier/team",
                terms: "team leader tl assign member",
                permission: "task:read",
              },
              ...destinations,
            ]
          : destinations
      }
      caseSearchTo="/verifier/queue"
      searchPlaceholder="Find a check or page"
      navigation={(onNavigate) => (
        <ConfigNavigation
          workspace="verifier"
          subtitle={team ? `${team.name}${isLead ? " · Team Leader" : ""}` : "Verification"}
          extraItems={isLead ? [TEAM_QUEUE, TEAM_MEMBERS, TEAM_ANNEXURE] : []}
          onNavigate={onNavigate}
        />
      )}
    >
      <Outlet />
    </RoleWorkspaceShell>
  );
}
