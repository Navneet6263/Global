import assert from "node:assert/strict";
import { test } from "node:test";
import { NavigationCountsService } from "../src/dashboards/navigation-counts.service";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";

void test("sidebar counts preserve branch scope and never load complete records", async () => {
  const filters: Record<string, unknown>[] = [];
  const count = ({ where }: { where: Record<string, unknown> }) => {
    filters.push(where);
    return Promise.resolve(2);
  };
  const db = {
    verificationCase: { count },
    clarification: { count },
    fieldVisit: { count },
  } as unknown as PrismaService;
  const result = await new NavigationCountsService(db).get({
    tenantId: 1n,
    branchId: 4n,
    roles: ["OPS_MANAGER"],
  } as Actor);
  assert.equal(result.counts.opsExceptions, 6);
  assert.equal(result.counts.criticalExceptions, 4);
  for (const filter of filters) {
    const scoped = (filter.case ?? filter) as Record<string, unknown>;
    assert.equal(scoped.tenantId, 1n);
    assert.deepEqual(scoped.OR, [{ branchId: 4n }, { branchId: null }]);
  }
});

void test("client badges calculate only their organisation's requests and rejected documents", async () => {
  const filters: Record<string, unknown>[] = [];
  const count = ({ where }: { where: Record<string, unknown> }) => {
    filters.push(where);
    return Promise.resolve(3);
  };
  const db = {
    clarification: { count },
    document: { count },
  } as unknown as PrismaService;
  const result = await new NavigationCountsService(db).get({
    tenantId: 1n,
    clientId: 12n,
    roles: ["CLIENT_ADMIN"],
  } as Actor);
  assert.deepEqual(result.counts, { clientActions: 6 });
  assert.equal(filters.length, 2);
  for (const filter of filters)
    assert.deepEqual(filter.case, { tenantId: 1n, clientId: 12n });
});
