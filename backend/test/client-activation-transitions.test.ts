import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { ClientsService } from "../src/clients/clients.service";

void test("onboarding cannot bypass activation checks through suspended state", async () => {
  let writes = 0;
  const prisma = {
    client: {
      findFirst: () => ({ id: 20n, version: 1, status: "ONBOARDING" }),
    },
    $transaction: () => {
      writes++;
    },
  };
  const service = new ClientsService(prisma as unknown as PrismaService);
  await assert.rejects(
    service.update({ tenantId: 10n } as Actor, "client", {
      version: 1,
      status: "SUSPENDED",
    }),
    /already inactive during onboarding/,
  );
  assert.equal(writes, 0);
});
