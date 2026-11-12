import type { CaseRow, PortalAccessRow, StoreCtx } from "./rm-eligibility-fixtures";

export function matchScalarOps(field: unknown, val: unknown): boolean {
  if (val === null || typeof val !== "object" || val instanceof Date) return field === val;
  const ops = val as Record<string, unknown>;
  if ("not" in ops && (ops.not === null ? field === null : field === ops.not)) return false;
  if ("in" in ops && !(ops.in as unknown[]).includes(field)) return false;
  if ("notIn" in ops && (ops.notIn as unknown[]).includes(field)) return false;
  if ("lt" in ops && (!(field instanceof Date) || !(field < (ops.lt as Date)))) return false;
  if ("gt" in ops && (!(field instanceof Date) || !(field > (ops.gt as Date)))) return false;
  if ("gte" in ops && (!(field instanceof Date) || !(field >= (ops.gte as Date)))) return false;
  if ("lte" in ops && (!(field instanceof Date) || !(field <= (ops.lte as Date)))) return false;
  return true;
}

export function matchAccess(row: PortalAccessRow, ctx: StoreCtx, where: Record<string, unknown> = {}): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === "OR" && !(v as Record<string, unknown>[]).some((sub) => matchAccess(row, ctx, sub))) return false;
    else if (k === "case") {
      const parent = ctx.cases.find((c) => c.id === row.caseId);
      if (!parent || !matchesWhere(parent, ctx, v as Record<string, unknown>)) return false;
    } else if (k !== "OR" && !matchScalarOps(row[k as keyof PortalAccessRow], v)) return false;
  }
  return true;
}

export function matchesWhere(row: CaseRow, ctx: StoreCtx, where: Record<string, unknown> = {}): boolean {
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === "AND") {
      if (!(val as Record<string, unknown>[]).every((sub) => matchesWhere(row, ctx, sub))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(val as Record<string, unknown>[]).some((sub) => matchesWhere(row, ctx, sub))) return false;
      continue;
    }
    if (key === "NOT") {
      const list = Array.isArray(val) ? val : [val];
      if ((list as Record<string, unknown>[]).some((sub) => matchesWhere(row, ctx, sub))) return false;
      continue;
    }
    if (key === "consents") {
      const none = (val as { none?: { status?: { in?: string[] } } }).none;
      if (none?.status?.in && ctx.consents.some((c) => c.caseId === row.id && none.status!.in!.includes(c.status))) return false;
      continue;
    }
    if (key === "candidateAccess") {
      const ca = val as { none?: Record<string, unknown>; some?: Record<string, unknown> };
      const links = ctx.accesses.filter((a) => a.caseId === row.id);
      if (ca.none && links.some((a) => matchAccess(a, ctx, ca.none))) return false;
      if (ca.some && !links.some((a) => matchAccess(a, ctx, ca.some))) return false;
      continue;
    }
    if (key === "client") {
      const pub = (val as { publicId?: string }).publicId;
      if (pub && row.client.publicId !== pub) return false;
      continue;
    }
    if (!matchScalarOps(row[key as keyof CaseRow], val)) return false;
  }
  return true;
}
