import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";

export function clientDashboardScope(actor: Actor) {
  if (!actor.clientId || !actor.roles.includes("CLIENT_ADMIN"))
    throw new ForbiddenException("A client workspace is required");
  return {
    tenantId: actor.tenantId,
    clientId: actor.clientId,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
  };
}

export async function clientBranchComparison(
  prisma: PrismaService,
  scope: ReturnType<typeof clientDashboardScope>,
  now: Date,
) {
  const [groups, overdue] = await Promise.all([
    prisma.verificationCase.groupBy({
      by: ["branchId", "status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.verificationCase.groupBy({
      by: ["branchId"],
      where: {
        ...scope,
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        dueAt: { lt: now },
      },
      _count: { _all: true },
    }),
  ]);
  const ids = [
    ...new Set(groups.flatMap((row) => (row.branchId ? [row.branchId] : []))),
  ];
  const branches = ids.length
    ? await prisma.branch.findMany({
        where: { tenantId: scope.tenantId, id: { in: ids } },
        select: { id: true, publicId: true, name: true, city: true },
      })
    : [];
  const names = new Map(branches.map((row) => [String(row.id), row]));
  const counts = new Map<
    string,
    {
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      pendingDocuments: number;
      clarifications: number;
    }
  >();
  for (const group of groups) {
    const key = String(group.branchId ?? "unassigned");
    const row = counts.get(key) ?? {
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      pendingDocuments: 0,
      clarifications: 0,
    };
    const count = group._count._all;
    row.total += count;
    if (["COMPLETED", "CLOSED"].includes(group.status)) row.completed += count;
    else if (group.status === "CANCELLED") row.cancelled += count;
    else row.active += count;
    if (group.status === "DOCUMENT_PENDING") row.pendingDocuments += count;
    if (group.status === "CLARIFICATION_PENDING") row.clarifications += count;
    counts.set(key, row);
  }
  return [...counts.entries()]
    .map(([key, row]) => ({
      id: names.get(key)?.publicId ?? null,
      name: names.get(key)?.name ?? "Not assigned",
      city: names.get(key)?.city ?? null,
      ...row,
      overdue:
        overdue.find((item) => String(item.branchId ?? "unassigned") === key)
          ?._count._all ?? 0,
      completionPercent: row.total
        ? Math.round((row.completed / row.total) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
}
