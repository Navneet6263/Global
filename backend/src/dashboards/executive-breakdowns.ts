import {
  average,
  type ExecutiveCaseRow,
  terminalStatuses,
} from "./executive-analytics.helpers";

export function stageAgeing(rows: ExecutiveCaseRow[], now: Date) {
  const groups = new Map<string, ExecutiveCaseRow[]>();
  rows.filter((row) => !terminalStatuses.includes(row.status)).forEach((row) => {
    groups.set(row.status, [...(groups.get(row.status) ?? []), row]);
  });
  return [...groups.entries()]
    .map(([status, cases]) => {
      const ages = cases.map((row) => (now.getTime() - row.updatedAt.getTime()) / 3_600_000);
      return {
        status,
        count: cases.length,
        averageAgeHours: average(ages) ?? 0,
        oldestAgeHours: Math.round(Math.max(...ages, 0)),
        atRisk: cases.filter(
          (row) => row.dueAt && row.dueAt < now || ["HIGH", "CRITICAL"].includes(row.riskLevel ?? ""),
        ).length,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function teamCapacity(rows: ExecutiveCaseRow[]) {
  const groups = new Map<string, { id: string; name: string; rows: ExecutiveCaseRow[] }>();
  rows.forEach((row) => {
    const id = row.assignedOpsUser?.publicId ?? "unassigned";
    const name = row.assignedOpsUser?.displayName ?? "Unassigned";
    const group = groups.get(id) ?? { id, name, rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  });
  return [...groups.values()]
    .map((group) => ({
      id: group.id,
      name: group.name,
      active: group.rows.filter((row) => !terminalStatuses.includes(row.status)).length,
      completed: group.rows.filter((row) => row.completedAt).length,
      overdue: group.rows.filter(
        (row) => row.dueAt && row.dueAt < new Date() && !terminalStatuses.includes(row.status),
      ).length,
    }))
    .sort((a, b) => b.active - a.active);
}

export function checkPerformance(rows: ExecutiveCaseRow[]) {
  const groups = new Map<string, ExecutiveCaseRow["checks"]>();
  rows.flatMap((row) => row.checks).forEach((check) => {
    groups.set(check.type, [...(groups.get(check.type) ?? []), check]);
  });
  return [...groups.entries()]
    .map(([type, checks]) => ({
      type,
      total: checks.length,
      completed: checks.filter((check) => check.completedAt).length,
      pending: checks.filter((check) => !check.completedAt).length,
      discrepancies: checks.filter((check) => check.result === "DISCREPANCY").length,
      unableToVerify: checks.filter((check) => check.result === "UNABLE_TO_VERIFY").length,
      averageTatHours: average(
        checks.flatMap((check) => check.completedAt
          ? [(check.completedAt.getTime() - check.createdAt.getTime()) / 3_600_000]
          : []),
      ),
    }))
    .sort((a, b) => b.total - a.total);
}
