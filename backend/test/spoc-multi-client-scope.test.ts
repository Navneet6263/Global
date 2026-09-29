import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "../src/auth/jwt.strategy";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import {
  SpocCaseQueryDto,
  SpocQaQueryDto,
} from "../src/spoc/dto/spoc-query.dto";
import { SpocCaseRecordsService } from "../src/spoc/spoc-case-records.service";
import { SpocClientsService } from "../src/spoc/spoc-clients.service";
import { SpocExceptionsService } from "../src/spoc/spoc-exceptions.service";
import { SpocOverviewService } from "../src/spoc/spoc-overview.service";
import { resolveSpocClients } from "../src/spoc/spoc-scope";
import { SpocWorkRecordsService } from "../src/spoc/spoc-work-records.service";
import {
  A,
  B,
  D,
  DOC,
  REQ,
  admin,
  assigned,
  spocABC,
  spocActor,
} from "./helpers/spoc-fixtures";
import { bigJson } from "./helpers/test-actor";
import { spocMonitor, vendorWriters } from "./helpers/vendor-fixtures";

void test("the resolver narrows only to assigned clients and never widens past them", () => {
  assert.deepEqual(resolveSpocClients(spocABC), {
    byClient: { clientId: { in: [41n, 42n, 43n] } },
    clientRow: { id: { in: [41n, 42n, 43n] } },
  });
  assert.deepEqual(resolveSpocClients(spocABC, B.toUpperCase()), {
    byClient: { clientId: { in: [42n] } },
    clientRow: { id: { in: [42n] } },
  });
  assert.throws(() => resolveSpocClients(spocABC, D), ForbiddenException);
  assert.throws(
    () => resolveSpocClients(spocActor(["SPOC_RM"], { spocClients: [] })),
    ForbiddenException,
  );
  assert.deepEqual(resolveSpocClients(admin), { byClient: {}, clientRow: {} });
  assert.deepEqual(resolveSpocClients(admin, D).clientRow, { publicId: D });
});

/** Records every query; returns empty results, or the three assigned client rows. */
function recordingPrisma() {
  const calls: Array<{ model: string; where: unknown }> = [];
  const clientRows = assigned.map((client) => ({
    id: client.id,
    publicId: client.publicId,
    code: client.name,
    displayName: client.name,
    status: "ACTIVE",
    creditHold: false,
  }));
  const prisma = new Proxy(
    {},
    {
      get: (_target, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_m, operation: string) =>
              (args: { where?: unknown } = {}) => {
                calls.push({ model, where: args.where });
                if (operation === "count") return Promise.resolve(0);
                if (operation === "findFirst")
                  return Promise.resolve(
                    model === "client" ? clientRows[0] : null,
                  );
                if (model === "client" && operation === "findMany")
                  return Promise.resolve(clientRows);
                return Promise.resolve([]);
              },
          },
        ),
    },
  ) as unknown as PrismaService;
  return { prisma, calls };
}

void test("with no client chosen, every SPOC-RM query is limited to the assigned clients", async () => {
  const { prisma, calls } = recordingPrisma();
  const page = { page: 1, pageSize: 20 };
  const files = {} as DocumentsService;
  const overview = new SpocOverviewService(prisma);
  const records = new SpocCaseRecordsService(prisma);
  const work = new SpocWorkRecordsService(prisma);
  const exceptions = new SpocExceptionsService(prisma);
  await overview.overview(spocABC, {});
  await overview.filters(spocABC);
  await new SpocClientsService(prisma).list(spocABC, page);
  await records.cases(spocABC, Object.assign(new SpocCaseQueryDto(), page));
  await records.qa(spocABC, Object.assign(new SpocQaQueryDto(), page));
  await work.tasks(spocABC, page);
  await work.visits(spocABC, page);
  await work.opportunities(spocABC, page);
  await work.invoices(spocABC, page);
  for (const category of [
    "overdue",
    "credit_hold",
    "followup_overdue",
    "invoice_overdue",
  ] as const)
    await exceptions.list(spocABC, { ...page, category });
  await spocMonitor(prisma, files).clients(spocABC, page);
  // The staff name list in /spoc/filters is not client data.
  const scoped = calls.filter((call) => call.model !== "user");
  assert.ok(scoped.length > 80, `inspected ${scoped.length} queries`);
  for (const call of scoped)
    assert.ok(
      bigJson(call.where).includes('"in":["41","42","43"]'),
      `${call.model} query is not limited to the assigned clients: ${bigJson(call.where)}`,
    );
});

void test("an unassigned client is refused everywhere a client can be chosen", async () => {
  const { prisma } = recordingPrisma();
  const page = { page: 1, pageSize: 20, clientId: D };
  await assert.rejects(
    new SpocOverviewService(prisma).overview(spocABC, { clientId: D }),
    ForbiddenException,
  );
  await assert.rejects(
    new SpocWorkRecordsService(prisma).invoices(spocABC, page),
    ForbiddenException,
  );
  await assert.rejects(
    new SpocClientsService(prisma).list(spocABC, page),
    ForbiddenException,
  );
  const monitor = spocMonitor(prisma, {} as DocumentsService);
  await assert.rejects(
    monitor.documents(spocABC, D, { page: 1, pageSize: 20 }),
    ForbiddenException,
  );
  await assert.rejects(monitor.clients(spocABC, page), ForbiddenException);
});

void test("vendor documents of an assigned client are scoped to that client only", async () => {
  const { prisma, calls } = recordingPrisma();
  const monitor = spocMonitor(prisma, {} as DocumentsService);
  await monitor.documents(spocABC, B, { page: 1, pageSize: 20 });
  assert.equal(
    bigJson(calls.find((call) => call.model === "client")?.where),
    bigJson({ tenantId: 7n, publicId: B, id: { in: [42n] } }),
  );
});

void test("any SPOC-RM on the client may re-assign, whoever made the assignment", async () => {
  let where: unknown;
  const colleague = spocActor(["SPOC_RM"], {
    userId: 12n,
    spocClients: [assigned[1]!],
  });
  const service = vendorWriters({
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        vendorAssignment: {
          findFirst: (args: { where: unknown }) => {
            where = args.where;
            return Promise.resolve(null);
          },
        },
      }),
  } as unknown as PrismaService);
  await assert.rejects(
    service.reassign(colleague, REQ, {
      vendorId: DOC,
      resolutionNote: "Clear scan uploaded",
      version: 2,
    }),
    NotFoundException,
  );
  // Scoped by the client of the case, never by who assigned it.
  assert.equal(
    bigJson(where),
    bigJson({
      tenantId: 7n,
      publicId: REQ,
      case: { tenantId: 7n, clientId: { in: [42n] } },
    }),
  );
});

void test("the actor carries live SPOC-RM clients, and other roles make no extra query", async () => {
  const scopeQueries: unknown[] = [];
  const strategy = (role: string) =>
    new JwtStrategy(
      { getOrThrow: () => "secret" } as unknown as ConfigService,
      {
        $queryRaw: () =>
          Promise.resolve([
            {
              userId: 11n,
              userPublicId: "u-11",
              tenantId: 7n,
              tenantPublicId: "t-7",
              tenantName: "Sapling Global",
              branchId: null,
              branchPublicId: null,
              branchName: null,
              clientId: null,
              clientPublicId: null,
              clientName: null,
              email: "x@example.com",
              displayName: "X",
              mustChangePassword: false,
              roleCode: role,
              permissionsJson: "[]",
            },
          ]),
        spocClientScope: {
          findMany: (args: unknown) => {
            scopeQueries.push(args);
            return Promise.resolve([
              { client: { id: 41n, publicId: A, displayName: "Client A" } },
            ]);
          },
        },
      } as unknown as PrismaService,
    );
  const payload = {
    type: "access" as const,
    sub: "u-11",
    tenantId: "t-7",
    email: "x@example.com",
    sessionId: "s-1",
  };
  const spoc = await strategy("SPOC_RM").validate(payload);
  assert.deepEqual(spoc.spocClients, [
    { id: 41n, publicId: A, name: "Client A" },
  ]);
  assert.equal(
    bigJson((scopeQueries[0] as { where: unknown }).where),
    bigJson({ userId: 11n, client: { tenantId: 7n } }),
  );
  const clientAdmin = await strategy("CLIENT_ADMIN").validate(payload);
  assert.equal(clientAdmin.spocClients, undefined);
  assert.equal(scopeQueries.length, 1);
});
