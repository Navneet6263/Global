import type { CaseListItem } from "@/lib/backend-api/cases";
import type { DirectoryUser } from "@/lib/backend-api/users";
import type { OpsCheckType } from "../contracts/case";
import type { OpsTeamMember, TeamCapacity } from "../contracts/operations";
import { typeOf } from "./api-operations-mappers";

const ACTIVE_TASK_STATES = new Set(["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"]);

type TaskWork = {
  caseId: string;
  checkType: OpsCheckType;
  dueAt?: string | null;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  assigneeId?: string;
};

export function buildVerifierTeam(
  cases: readonly CaseListItem[],
  users: readonly DirectoryUser[],
): TeamCapacity {
  const tasks = taskWork(cases);
  const activeUsers = users.filter((user) => user.status === "ACTIVE");
  const initial = activeUsers.map((user) => memberFor(user, tasks));
  const peak = Math.max(...initial.map((member) => member.activeChecks), 1);
  const members = initial.map((member) => ({
    ...member,
    relativeLoadPercent: Math.round((member.activeChecks / peak) * 100),
  }));
  const openChecks = cases
    .flatMap((item) => item.checks)
    .filter((check) => check.status !== "COMPLETED");

  return {
    members,
    workload: members.map((member) => ({
      name: member.name,
      checks: member.activeChecks,
    })),
    branches: branchLoad(members),
    demand: demandByType(openChecks),
    openAssignments: openChecks.filter((check) => {
      const active = (check.tasks ?? []).find((task) => ACTIVE_TASK_STATES.has(task.status));
      return !active?.assignee;
    }).length,
  };
}

function taskWork(cases: readonly CaseListItem[]): TaskWork[] {
  return cases.flatMap((item) =>
    item.checks.flatMap((check) =>
      (check.tasks ?? []).map((task) => ({
        caseId: item.id,
        checkType: typeOf(check.type),
        dueAt: task.dueAt ?? check.dueAt ?? item.dueAt,
        status: task.status,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        assigneeId: task.assignee?.publicId,
      })),
    ),
  );
}

function memberFor(user: DirectoryUser, tasks: readonly TaskWork[]): OpsTeamMember {
  const owned = tasks.filter((task) => task.assigneeId === user.id);
  const active = owned.filter((task) => ACTIVE_TASK_STATES.has(task.status));
  const completedToday = owned.filter(
    (task) => task.completedAt && isToday(task.completedAt),
  ).length;
  const turnaround = owned.flatMap((task) => {
    if (!task.startedAt || !task.completedAt) return [];
    const minutes = Math.round(
      (Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 60_000,
    );
    return minutes >= 0 ? [minutes] : [];
  });
  return {
    id: user.id,
    name: user.displayName,
    role: "Verifier",
    branch: user.branch?.name ?? "No branch assigned",
    activeCases: new Set(active.map((task) => task.caseId)).size,
    activeChecks: active.length,
    dueToday: active.filter((task) => task.dueAt && isToday(task.dueAt)).length,
    overdue: active.filter((task) => task.dueAt && Date.parse(task.dueAt) < Date.now()).length,
    completedToday,
    averageTurnaroundMinutes: turnaround.length
      ? Math.round(turnaround.reduce((total, value) => total + value, 0) / turnaround.length)
      : null,
    relativeLoadPercent: 0,
  };
}

function branchLoad(members: readonly OpsTeamMember[]) {
  const groups = new Map<string, OpsTeamMember[]>();
  members.forEach((member) =>
    groups.set(member.branch, [...(groups.get(member.branch) ?? []), member]),
  );
  const total = Math.max(
    1,
    members.reduce((sum, member) => sum + member.activeChecks, 0),
  );
  return [...groups.entries()].map(([branch, rows]) => {
    const openChecks = rows.reduce((sum, member) => sum + member.activeChecks, 0);
    return {
      branch,
      members: rows.length,
      openChecks,
      loadPercent: Math.round((openChecks / total) * 100),
    };
  });
}

function demandByType(checks: readonly CaseListItem["checks"][number][]) {
  const counts = new Map<OpsCheckType, number>();
  checks.forEach((check) => {
    const type = typeOf(check.type);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });
  return [...counts.entries()].map(([checkType, open]) => ({ checkType, open }));
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
