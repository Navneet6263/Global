export const terminalStatuses = ["COMPLETED", "CLOSED", "CANCELLED"];

export interface ExecutiveCaseRow {
  publicId: string;
  caseNumber: string;
  status: string;
  priority: string;
  riskLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  subject: { fullName: string };
  client: { publicId: string; displayName: string };
  branch: { publicId: string; name: string } | null;
  assignedOpsUser: { publicId: string; displayName: string } | null;
  checks: Array<{
    type: string;
    status: string;
    result: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  clarifications: Array<{ status: string }>;
  fieldVisits: Array<{ status: string }>;
}

export function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export function average(values: number[]) {
  return values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null;
}

export function caseStats(rows: ExecutiveCaseRow[], now: Date) {
  const completed = rows.filter((row) => row.completedAt);
  const eligible = completed.filter((row) => row.dueAt);
  const withinSla = eligible.filter((row) => row.completedAt! <= row.dueAt!).length;
  const overdue = rows.filter(
    (row) => row.dueAt && row.dueAt < now && !terminalStatuses.includes(row.status),
  ).length;
  return {
    total: rows.length,
    active: rows.filter((row) => !terminalStatuses.includes(row.status)).length,
    completed: completed.length,
    overdue,
    slaPercentage: percent(withinSla, eligible.length),
    averageTatHours: average(
      completed.map((row) => (row.completedAt!.getTime() - row.createdAt.getTime()) / 3_600_000),
    ),
  };
}

export function groupedPerformance(
  rows: ExecutiveCaseRow[],
  now: Date,
  kind: "client" | "branch",
) {
  const groups = new Map<string, { id: string; name: string; rows: ExecutiveCaseRow[] }>();
  for (const row of rows) {
    const entity = kind === "client" ? row.client : row.branch;
    const id = entity?.publicId ?? "unassigned";
    const name = kind === "client" ? row.client.displayName : (row.branch?.name ?? "Unassigned");
    const current: { id: string; name: string; rows: ExecutiveCaseRow[] } =
      groups.get(id) ?? { id, name, rows: [] };
    current.rows.push(row);
    groups.set(id, current);
  }
  return [...groups.values()]
    .map((group) => ({ id: group.id, name: group.name, ...caseStats(group.rows, now) }))
    .sort((a, b) => b.total - a.total);
}

export function attentionQueue(rows: ExecutiveCaseRow[], now: Date) {
  return rows
    .flatMap((row) => {
      if (terminalStatuses.includes(row.status)) return [];
      const reasons: string[] = [];
      if (row.dueAt && row.dueAt < now) reasons.push("Overdue");
      if (["HIGH", "CRITICAL"].includes(row.riskLevel ?? "")) reasons.push(`${row.riskLevel} risk`);
      if (row.priority === "URGENT") reasons.push("Urgent priority");
      if (row.clarifications.some((item) => ["OPEN", "RESPONDED"].includes(item.status)))
        reasons.push("Clarification open");
      if (row.fieldVisits.some((item) => item.status === "EXCEPTION_REVIEW"))
        reasons.push("Field exception");
      if (!reasons.length) return [];
      const ageHours = Math.max(0, (now.getTime() - row.updatedAt.getTime()) / 3_600_000);
      const severity = reasons.includes("Overdue") || reasons.includes("CRITICAL risk") ? 3 :
        reasons.includes("HIGH risk") || reasons.includes("Urgent priority") ? 2 : 1;
      return [{ ...presentCase(row), reasons, severity, ageHours: Math.round(ageHours) }];
    })
    .sort((a, b) => b.severity - a.severity || b.ageHours - a.ageHours)
    .slice(0, 12);
}

export function presentCase(row: ExecutiveCaseRow) {
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    status: row.status,
    priority: row.priority,
    riskLevel: row.riskLevel ?? "UNCLASSIFIED",
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    dueAt: row.dueAt,
    updatedAt: row.updatedAt,
    subject: row.subject,
    client: row.client,
    branch: row.branch,
    owner: row.assignedOpsUser,
  };
}
