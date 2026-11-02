import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { CasesService } from "../src/cases/cases.service";
import type { CreateCaseDto } from "../src/cases/dto/create-case.dto";
import { BulkIntakeController } from "../src/clients/bulk-intake.controller";
import type { PrismaService } from "../src/database/prisma.service";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const actor = (roles: string[], spocClients: Array<{ id: bigint }> = []) =>
  ({ tenantId: 1n, roles, spocClients }) as unknown as Actor;

function controller(found: boolean) {
  const wheres: Array<Record<string, unknown>> = [];
  const created: unknown[] = [];
  const prisma = {
    client: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        wheres.push(where);
        return Promise.resolve(found ? { id: 9n } : null);
      },
    },
  } as unknown as PrismaService;
  const cases = {
    create: (_: Actor, input: unknown) => {
      created.push(input);
      return Promise.resolve({ id: "new" });
    },
  } as unknown as CasesService;
  return { api: new BulkIntakeController(cases, prisma), wheres, created };
}
const row = { clientId: CLIENT } as CreateCaseDto;

void test("an RM can bulk-start cases only for its own clients", async () => {
  const { api, wheres, created } = controller(false);
  await assert.rejects(
    api.create(actor(["SPOC_RM"], [{ id: 5n }]), row),
    ForbiddenException,
  );
  assert.deepEqual(wheres[0]?.["id"], { in: [5n] });
  assert.equal(created.length, 0);
});

void test("Data Entry and Operations are not narrowed to one client list", async () => {
  for (const role of ["DATA_ENTRY", "OPS_MANAGER"]) {
    const { api, wheres, created } = controller(true);
    await api.create(actor([role]), row);
    assert.equal(wheres[0]?.["id"], undefined);
    assert.equal(created.length, 1);
  }
});
