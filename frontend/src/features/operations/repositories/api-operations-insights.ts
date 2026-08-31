import { getExecutiveDashboard } from "@/lib/backend-api/dashboards";
import { listAllUsers } from "@/lib/backend-api/users";
import { baseCase, fieldStatus, stages } from "./api-operations-mappers";
import { listAllOperationCases } from "./api-operations-cases";
import { buildVerifierTeam } from "./api-operations-team";

export async function getSlaPerformance() {
  const data = await getExecutiveDashboard({ months: 12 });
  const cases = data.caseRegister.map((row) =>
    baseCase({
      ...row,
      externalRef: null,
      version: 1,
      subject: { publicId: row.id, fullName: row.subject.fullName },
      client: { publicId: row.client.publicId, code: "", displayName: row.client.displayName },
      branch: row.branch,
      assignedOpsUser: row.owner,
      checks: [],
    }),
  );
  return {
    healthPercent: data.performance.slaPercentage,
    dueNext7Days: data.forecast.dueNext7Days,
    overdue: data.summary.overdue,
    averageTurnaroundMinutes:
      data.performance.completedCases > 0 && data.performance.averageTatHours !== null
        ? Math.round(data.performance.averageTatHours * 60)
        : null,
    atRisk: cases.filter((row) => row.slaState !== "healthy"),
    stageAgeing: data.stageAgeing.map((row) => ({
      stage: stages[row.status] ?? "verification",
      averageAgeMinutes: Math.round(row.averageAgeHours * 60),
      oldestAgeMinutes: Math.round(row.oldestAgeHours * 60),
    })),
    byClient: data.clientPerformance.map((row) => ({
      name: row.name,
      onTimePercent: row.slaPercentage,
      volume: row.total,
    })),
    byPackage: [],
    weeklyTrend: data.performanceTrend.map((row) => ({
      label: row.month,
      onTimePercent: row.slaPercentage,
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
  const [cases, users] = await Promise.all([listAllOperationCases(), listAllUsers("VERIFIER")]);
  return buildVerifierTeam(cases, users.items);
}

export async function getFieldOperations() {
  const [cases, users] = await Promise.all([
    listAllOperationCases(),
    listAllUsers("FIELD_EXECUTIVE"),
  ]);
  const records = cases.flatMap((item) =>
    (item.fieldVisits ?? []).map((visit) => ({ item, visit })),
  );
  const visits = records.map(({ item, visit }) => ({
    id: visit.publicId,
    caseId: item.id,
    caseNumber: item.caseNumber,
    candidateName: item.subject.fullName,
    clientName: item.client.displayName,
    address: visit.address,
    city: item.branch?.city ?? item.branch?.name ?? "Location not recorded",
    fieldExecutive: visit.assignee?.displayName ?? "Unassigned",
    scheduledAt: visit.createdAt,
    status: fieldStatus(visit.status),
    geofenceMetres: visit.geofenceMeters,
    evidenceCount: visit._count?.evidence ?? 0,
    note:
      visit.distanceMeters !== null && visit.distanceMeters !== undefined
        ? `${Math.round(Number(visit.distanceMeters))} m from target · ${visit.geofenceMeters} m allowed`
        : "",
  }));
  const todayRecords = records.filter(({ visit }) => fieldActivityToday(visit));
  const activeStates = new Set(["ASSIGNED", "IN_PROGRESS", "EVIDENCE_PENDING"]);

  return {
    scheduled: records.filter(({ visit }) => visit.status === "ASSIGNED").length,
    today: todayRecords.length,
    checkedIn: records.filter(({ visit }) => visit.status === "IN_PROGRESS").length,
    evidencePending: records.filter(({ visit }) => visit.status === "EVIDENCE_PENDING").length,
    outsideGeofence: records.filter(
      ({ visit }) =>
        visit.status === "OUTSIDE_GEOFENCE" ||
        (visit.distanceMeters !== null &&
          visit.distanceMeters !== undefined &&
          Number(visit.distanceMeters) > visit.geofenceMeters),
    ).length,
    exceptionReview: records.filter(({ visit }) => visit.status === "EXCEPTION_REVIEW").length,
    completed: records.filter(({ visit }) => visit.status === "COMPLETED").length,
    visits,
    executiveLoad: users.items
      .filter((user) => user.status === "ACTIVE")
      .map((user) => {
        const owned = records.filter(({ visit }) => visit.assignee?.publicId === user.id);
        return {
          name: user.displayName,
          city: user.branch?.name ?? "No branch assigned",
          visitsToday: owned.filter(({ visit }) => fieldActivityToday(visit)).length,
          open: owned.filter(({ visit }) => activeStates.has(visit.status)).length,
        };
      }),
  };
}

type FieldVisitRecord = NonNullable<
  Awaited<ReturnType<typeof listAllOperationCases>>[number]["fieldVisits"]
>[number];

function fieldActivityToday(visit: FieldVisitRecord) {
  return [visit.createdAt, visit.checkedInAt, visit.capturedAt, visit.completedAt].some(
    (value) => value && isToday(value),
  );
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
