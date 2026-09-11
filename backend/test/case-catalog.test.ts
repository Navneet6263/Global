import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { caseServiceCatalog } from "../src/cases/case-service-plan";
import { CaseCatalogQueryDto } from "../src/cases/dto/case-catalog-query.dto";
import { Permission } from "../src/common/auth/permissions";

const clientId = "e161b217-fb46-4372-a419-c293be55d32c";
const otherClientId = "c0390236-9d8b-4baf-a539-6d10b29204bd";
const packages = [
  { id: 10n, publicId: "package-1", code: "P1", name: "First", isActive: true },
  {
    id: 11n,
    publicId: "package-2",
    code: "P2",
    name: "Second",
    isActive: true,
  },
].map((pkg) => ({
  ...pkg,
  tenantId: 1n,
  serviceFamily: "HIRECHECK",
  checksJson: '["IDENTITY"]',
  requiredDocumentsJson: '["PAN"]',
  tatHours: 96,
  price: 900,
}));
const defaultRates = [
  { servicePackageId: 10n, active: true, unitPrice: 650, tatHours: 72 },
  { servicePackageId: 11n, active: false, unitPrice: 450, tatHours: 12 },
];
const user = (extra: Partial<Actor> = {}) =>
  ({
    tenantId: 1n,
    roles: ["OPS_MANAGER"],
    permissions: [Permission.CaseCreate, Permission.ClientRead],
    ...extra,
  }) as Actor;

function database(
  options: { rates?: typeof defaultRates; status?: string } = {},
) {
  const calls = { client: 0, packages: 0 };
  const clients = [
    {
      id: 2n,
      publicId: clientId,
      tenantId: 1n,
      status: options.status ?? "ACTIVE",
      slaHours: 36,
      packageRates: options.rates ?? defaultRates,
    },
    {
      id: 3n,
      publicId: otherClientId,
      tenantId: 2n,
      status: "ACTIVE",
      slaHours: 120,
      packageRates: defaultRates,
    },
  ];
  const prisma = {
    client: {
      findFirst: ({
        where,
      }: {
        where: {
          id?: bigint;
          publicId?: string;
          tenantId: bigint;
          status: string;
        };
      }) => {
        calls.client += 1;
        return Promise.resolve(
          clients.find(
            (row) =>
              row.tenantId === where.tenantId &&
              row.status === where.status &&
              (where.id === undefined || row.id === where.id) &&
              (where.publicId === undefined || row.publicId === where.publicId),
          ) ?? null,
        );
      },
    },
    servicePackage: {
      findMany: ({
        where,
      }: {
        where: { tenantId: bigint; isActive: boolean; id?: { in: bigint[] } };
      }) => {
        calls.packages += 1;
        return Promise.resolve(
          packages.filter(
            (pkg) =>
              pkg.tenantId === where.tenantId &&
              pkg.isActive === where.isActive &&
              (!where.id || where.id.in.includes(pkg.id)),
          ),
        );
      },
    },
  } as unknown as PrismaService;
  return { prisma, calls };
}

void test("catalogue query accepts an optional UUID and rejects malformed client identifiers", async () => {
  assert.equal(
    (await validate(plainToInstance(CaseCatalogQueryDto, {}))).length,
    0,
  );
  assert.equal(
    (await validate(plainToInstance(CaseCatalogQueryDto, { clientId }))).length,
    0,
  );
  assert.ok(
    (
      await validate(
        plainToInstance(CaseCatalogQueryDto, { clientId: "wrong" }),
      )
    ).length,
  );
});

void test("selected-client catalogue filters entitlements and returns tighter SLA without exposing Ops prices", async () => {
  const result = await caseServiceCatalog(database().prisma, user(), clientId);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["package-1"],
  );
  assert.equal(result.items[0]?.tatHours, 36);
  assert.equal(Object.hasOwn(result.items[0], "price"), false);
});

void test("commercially authorised admin receives selected-client contracted price", async () => {
  const result = await caseServiceCatalog(
    database().prisma,
    user({ roles: ["PLATFORM_ADMIN"], permissions: ["*"] }),
    clientId,
  );
  assert.equal(result.items[0]?.price, 650);
});

void test("finance-authorised case creator can read contracted price", async () => {
  const result = await caseServiceCatalog(
    database().prisma,
    user({ permissions: [Permission.CaseCreate, Permission.FinanceRead] }),
    clientId,
  );
  assert.equal(result.items[0]?.price, 650);
});

void test("client-bound no-argument caller retains its own catalogue and price", async () => {
  const result = await caseServiceCatalog(
    database().prisma,
    user({ roles: ["CLIENT_ADMIN"], clientId: 2n }),
  );
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["package-1"],
  );
  assert.equal(result.items[0]?.price, 650);
  assert.equal(result.items[0]?.tatHours, 36);
});

void test("client scope cannot be replaced with query parameters, even with mixed admin roles", async () => {
  const { prisma, calls } = database();
  await assert.rejects(
    caseServiceCatalog(
      prisma,
      user({
        clientId: 2n,
        roles: ["CLIENT_ADMIN", "PLATFORM_ADMIN"],
        permissions: ["*"],
      }),
      otherClientId,
    ),
    NotFoundException,
  );
  assert.equal(calls.packages, 0);
});

void test("cross-tenant, inactive and missing-client scopes fail closed", async () => {
  await assert.rejects(
    caseServiceCatalog(database().prisma, user(), otherClientId),
    NotFoundException,
  );
  await assert.rejects(
    caseServiceCatalog(
      database({ status: "SUSPENDED" }).prisma,
      user(),
      clientId,
    ),
    NotFoundException,
  );
  const db = database();
  await assert.rejects(
    caseServiceCatalog(db.prisma, user({ roles: ["CLIENT_ADMIN"] })),
    ForbiddenException,
  );
  assert.deepEqual(db.calls, { client: 0, packages: 0 });
});

void test("tenant catalogue compatibility and unmapped-client fallback retain active packages", async () => {
  const tenant = await caseServiceCatalog(database().prisma, user());
  assert.equal(tenant.items.length, 2);
  assert.equal(tenant.items[0]?.price, 900);
  assert.equal(tenant.items[0]?.tatHours, 96);
  const fallback = await caseServiceCatalog(
    database({ rates: [] }).prisma,
    user(),
    clientId,
  );
  assert.equal(fallback.items.length, 2);
  assert.equal(fallback.items[0]?.tatHours, 36);
});

void test("all-disabled entitlements cannot fall back to the tenant catalogue", async () => {
  const result = await caseServiceCatalog(
    database({
      rates: defaultRates.map((rate) => ({ ...rate, active: false })),
    }).prisma,
    user(),
    clientId,
  );
  assert.deepEqual(result.items, []);
});
