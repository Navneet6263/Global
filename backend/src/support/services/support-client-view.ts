import { terminalCaseStatuses } from "../../spoc/spoc-holder";

interface ClientRow {
  id: bigint;
  publicId: string;
  code: string;
  displayName: string;
  status: string;
}

interface StatusGroup {
  clientId: bigint;
  status: string;
  _count: { _all: number };
  _max: { updatedAt: Date | null };
}

interface CountGroup {
  clientId: bigint;
  _count: { _all: number };
}

/** One client card on the support desk: employee totals, exceptions and open requests. */
export function toSupportClient(
  row: ClientRow,
  totals: readonly StatusGroup[],
  exceptions: readonly CountGroup[],
  requests: readonly CountGroup[],
) {
  const own = totals.filter((group) => group.clientId === row.id);
  const count = (match: (status: string) => boolean) =>
    own
      .filter((group) => match(group.status))
      .reduce((sum, group) => sum + group._count._all, 0);
  const updated = own
    .map((group) => group._max.updatedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const countFor = (groups: readonly CountGroup[]) =>
    groups.find((group) => group.clientId === row.id)?._count._all ?? 0;
  return {
    id: row.publicId,
    code: row.code,
    displayName: row.displayName,
    status: row.status,
    employees: count(() => true),
    active: count((status) => !terminalCaseStatuses.includes(status)),
    completed: count((status) => ["COMPLETED", "CLOSED"].includes(status)),
    cancelled: count((status) => status === "CANCELLED"),
    exceptions: countFor(exceptions),
    openRequests: countFor(requests),
    lastUpdated: updated ?? null,
  };
}
