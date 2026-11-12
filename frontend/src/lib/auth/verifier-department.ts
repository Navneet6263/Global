import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { getSession } from "@/lib/api/auth";
import { listDepartments } from "@/lib/backend-api/workflow";

const ACTIVE_DEPT_KEY = "sg-active-verifier-department";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerifierTeamOption {
  id: string;
  name: string;
  teamType?: string | null;
  role?: "LEAD" | "MEMBER";
}

export function isValidDepartmentId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function validateVerifierDepartmentSearch(input: Record<string, unknown>): {
  department?: string;
} {
  return {
    department: isValidDepartmentId(input["department"]) ? input["department"] : undefined,
  };
}

export function rememberedVerifierDepartment(): string | undefined {
  try {
    const saved = localStorage.getItem(ACTIVE_DEPT_KEY);
    return isValidDepartmentId(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

export function rememberVerifierDepartment(departmentId: string) {
  if (!isValidDepartmentId(departmentId)) return;
  try {
    localStorage.setItem(ACTIVE_DEPT_KEY, departmentId);
  } catch {
    /* Preference only. */
  }
}

export function clearVerifierDepartment() {
  try {
    localStorage.removeItem(ACTIVE_DEPT_KEY);
  } catch {
    /* Preference only. */
  }
}

export function resolveActiveVerifierDepartment(input: {
  urlDepartment?: string;
  remembered?: string;
  supervisor: boolean;
  led: readonly VerifierTeamOption[];
  teams: readonly VerifierTeamOption[];
}): { departmentId?: string; team?: VerifierTeamOption } {
  const urlId = isValidDepartmentId(input.urlDepartment) ? input.urlDepartment : undefined;
  const savedId = isValidDepartmentId(input.remembered) ? input.remembered : undefined;

  if (urlId) {
    const team = input.teams.find((t) => t.id === urlId) ?? input.led.find((t) => t.id === urlId);
    if (input.supervisor || !input.led.length || input.led.some((t) => t.id === urlId)) {
      return { departmentId: urlId, team };
    }
  }

  if (savedId) {
    if (input.supervisor) {
      return {
        departmentId: savedId,
        team: input.teams.find((t) => t.id === savedId),
      };
    }
    const ledMatch = input.led.find((t) => t.id === savedId);
    if (ledMatch) {
      return { departmentId: ledMatch.id, team: ledMatch };
    }
  }

  if (!input.supervisor && input.led.length === 1) {
    return { departmentId: input.led[0]!.id, team: input.led[0]! };
  }

  return {};
}

export function useVerifierDepartment() {
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const rawDept = useLocation({
    select: (loc) => (loc.search as Record<string, unknown> | undefined)?.["department"],
  });
  const urlDepartment = isValidDepartmentId(rawDept) ? rawDept : undefined;

  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const roles = session.data?.roles ?? [];
  const supervisor = roles.includes("PLATFORM_ADMIN") || roles.includes("OPS_MANAGER");
  const led = (session.data?.departments ?? []).filter(
    (d) => d.kind === "VERIFICATION" && d.role === "LEAD",
  );
  const allDepartments = useQuery({
    queryKey: ["workflow", "departments"],
    queryFn: listDepartments,
    enabled: supervisor && pathname.startsWith("/verifier"),
    staleTime: 60_000,
    retry: false,
  });

  const teams: VerifierTeamOption[] = supervisor
    ? (allDepartments.data?.items ?? []).filter(
        (d) => d.kind === "VERIFICATION" && d.status === "ACTIVE",
      )
    : led;

  const resolved = resolveActiveVerifierDepartment({
    urlDepartment,
    remembered: rememberedVerifierDepartment(),
    supervisor,
    led,
    teams,
  });

  useEffect(() => {
    if (urlDepartment && (supervisor || led.some((d) => d.id === urlDepartment))) {
      rememberVerifierDepartment(urlDepartment);
    }
  }, [led, supervisor, urlDepartment]);

  return {
    departmentId: resolved.departmentId,
    activeTeam: resolved.team,
    supervisor,
    isLead: led.length > 0,
    led,
    teams,
  };
}
