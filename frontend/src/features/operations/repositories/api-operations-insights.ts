import { getExceptionsDashboard, getExecutiveDashboard } from "@/lib/backend-api/dashboards";
import { listUsers } from "@/lib/backend-api/users";
import type { OpsCheckType } from "../contracts/case";
import { baseCase, stages } from "./api-operations-mappers";

export async function getSlaPerformance() {
  const data = await getExecutiveDashboard({ months: 12 });
  const cases = data.caseRegister.map((row) =>
    baseCase({
      ...row,
      externalRef: null,
      version: 1,
      subject: { publicId: row.id, fullName: row.subject.fullName },
      client: { publicId: row.client.publicId, code: "", displayName: row.client.displayName },
      checks: [],
    }),
  );
  return {
    healthPercent: data.performance.slaPercentage ?? 0,
    dueToday: data.forecast.dueNext7Days,
    dueTomorrow: 0,
    overdue: data.summary.overdue,
    averageTurnaroundMinutes: Math.round(data.performance.averageTatHours * 60),
    atRisk: cases.filter((row) => row.slaState !== "healthy"),
    stageAgeing: data.stageAgeing.map((row) => ({
      stage: stages[row.status] ?? "verification",
      averageAgeMinutes: Math.round(row.averageAgeHours * 60),
      oldestAgeMinutes: Math.round(row.oldestAgeHours * 60),
    })),
    byClient: data.clientPerformance.map((row) => ({
      name: row.name,
      onTimePercent: row.slaPercentage ?? 0,
      volume: row.total,
    })),
    byPackage: [],
    weeklyTrend: data.performanceTrend.map((row) => ({
      label: row.month,
      onTimePercent: row.slaPercentage ?? 0,
      breaches: row.overdue,
    })),
    breachReasons: [],
    bottlenecks: data.stageAgeing
      .filter((row) => row.atRisk > 0)
      .map((row) => ({
        stage: stages[row.status] ?? "verification",
        detail: "Cases at SLA risk",
        impactedCases: row.atRisk,
      })),
  };
}
export async function getTeamCapacity() {
  const [data, users] = await Promise.all([
    getExecutiveDashboard({ months: 1 }),
    listUsers("VERIFIER"),
  ]);
  const members = users.items.map((user) => {
    const stats = data.teamCapacity.find((row) => row.id === user.id);
    const active = stats?.active ?? 0;
    return {
      id: user.id,
      name: user.displayName,
      role: "Verifier",
      branch: user.branch?.name ?? "All branches",
      skills: [
        "identity",
        "address",
        "employment",
        "education",
        "criminal",
        "reference",
      ] as OpsCheckType[],
      activeCases: active,
      activeChecks: active,
      dueToday: 0,
      overdue: stats?.overdue ?? 0,
      completedToday: stats?.completed ?? 0,
      averageTurnaroundMinutes: 0,
      capacity:
        active > 12
          ? ("overloaded" as const)
          : active > 8
            ? ("stretched" as const)
            : active > 3
              ? ("balanced" as const)
              : ("available" as const),
      capacityPercent: Math.min(100, Math.round((active / 12) * 100)),
      availability: "available" as const,
    };
  });
  return {
    members,
    workload: members.map((row) => ({
      name: row.name,
      checks: row.activeChecks,
      capacityPercent: row.capacityPercent,
    })),
    branches: [],
    demand: [],
    overloaded: members.filter((row) => row.capacity === "overloaded").map((row) => row.name),
    underutilised: members.filter((row) => row.capacity === "available").map((row) => row.name),
    openAssignments: data.forecast.unassignedActive,
  };
}
export async function getFieldOperations() {
  const data = await getExceptionsDashboard();
  const visits = data.fieldVisits.map((row) => ({
    id: row.id,
    caseId: row.case.publicId,
    caseNumber: row.case.caseNumber,
    candidateName: row.case.subject.fullName,
    clientName: row.case.client.displayName,
    address: row.address,
    city: "—",
    fieldExecutive: row.assignee?.displayName ?? "Unassigned",
    scheduledAt: row.createdAt,
    status: "exception_review" as const,
    geofenceMetres: row.geofenceMeters,
    evidenceCount: 0,
    note: row.distanceMeters ? `${row.distanceMeters} metres from target` : "",
  }));
  return {
    scheduled: 0,
    today: 0,
    checkedIn: 0,
    evidencePending: 0,
    outsideGeofence: visits.filter((row) => row.note).length,
    exceptionReview: visits.length,
    completed: 0,
    visits,
    executiveLoad: [],
  };
}
