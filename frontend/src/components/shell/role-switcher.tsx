import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { ArrowLeftRight, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { getSession } from "@/lib/api/auth";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { listDepartments } from "@/lib/backend-api/workflow";
import { ROLE_HOME, rememberRole } from "@/lib/auth/role-home";

/** The role whose workspace the current page belongs to. */
function activeRole(roles: readonly Role[], pathname: string): Role | null {
  return (
    roles.find((role) => {
      const home = ROLE_HOME[role];
      return home ? pathname.startsWith(home.split("/").slice(0, 2).join("/")) : false;
    }) ?? null
  );
}

/**
 * "Working as" switch for people who hold more than one working role (for example RM +
 * Data Entry) or lead more than one team. Verification is listed team by team: "TL
 * Education" opens that team's queue. Operations and Platform Admin may work every team's
 * queue (the API allows it), so they see them all. Hidden for everyone else. The role
 * choice is remembered for the next sign-in.
 */
export function RoleSwitcher() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const roles = (cachedIdentity()?.roles ?? []).filter((role) => ROLE_HOME[role]);
  const supervisor = roles.some((role) => role === "PLATFORM_ADMIN" || role === "OPS_MANAGER");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const all = useQuery({
    queryKey: ["workflow", "departments"],
    queryFn: listDepartments,
    enabled: supervisor && roles.includes("VERIFIER"),
    staleTime: 60_000,
    retry: false,
  });
  const led = (session.data?.departments ?? []).filter(
    (team) => team.kind === "VERIFICATION" && team.role === "LEAD",
  );
  const leads = (id: string) => led.some((team) => team.id === id);
  // Teams this person leads come first; for them they verify and manage, not only view.
  const teams = (
    roles.includes("VERIFIER")
      ? supervisor
        ? (all.data?.items ?? []).filter(
            (team) => team.kind === "VERIFICATION" && team.status === "ACTIVE",
          )
        : led
      : []
  )
    .slice()
    .sort((a, b) => Number(leads(b.id)) - Number(leads(a.id)));
  if (roles.length < 2 && teams.length < 2) return null;
  const current = activeRole(roles, pathname) ?? roles[0]!;
  const teamId = (search as { department?: string }).department;
  const onTeamPage = pathname.replace(/\/$/, "") === "/verifier/team";
  const activeTeam = pathname.startsWith("/verifier")
    ? ((onTeamPage ? teams.find((team) => team.id === teamId) : undefined) ??
      (!supervisor && led.length === 1 ? led[0] : undefined))
    : undefined;
  const openTeam = (id: string) => {
    rememberRole("VERIFIER");
    void navigate({ to: "/verifier/team", search: { department: id } });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="role-switcher" aria-label="Switch role">
          <ArrowLeftRight aria-hidden />
          <span>
            <small>Working as</small>
            <strong>
              {activeTeam ? `TL ${activeTeam.name}` : ROLE_DEFINITIONS[current].label}
            </strong>
          </span>
          <ChevronDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-64 overflow-y-auto rounded-xl p-1.5"
      >
        <DropdownMenuLabel>Switch role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <Fragment key={role}>
            <DropdownMenuItem
              onSelect={() => {
                rememberRole(role);
                void navigate({ to: ROLE_HOME[role]! as "/" });
              }}
              className="flex items-start gap-2"
            >
              <Check
                aria-hidden
                className={`mt-0.5 size-4 shrink-0 ${role === current && !activeTeam ? "text-blue-600" : "opacity-0"}`}
              />
              <span className="grid">
                <span className="text-[13px] font-semibold">{ROLE_DEFINITIONS[role].label}</span>
                <span className="text-[11px] text-slate-500">
                  {ROLE_DEFINITIONS[role].description}
                </span>
              </span>
            </DropdownMenuItem>
            {role === "VERIFIER"
              ? teams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onSelect={() => openTeam(team.id)}
                    className="flex items-start gap-2"
                  >
                    <Check
                      aria-hidden
                      className={`mt-0.5 size-4 shrink-0 ${activeTeam?.id === team.id ? "text-blue-600" : "opacity-0"}`}
                    />
                    <span className="grid">
                      <span className="text-[13px] font-semibold">TL {team.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {leads(team.id) ? "You lead this team" : `Team queue of ${team.name}`}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              : null}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
