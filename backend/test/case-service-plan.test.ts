import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  loadCaseServicePlan,
  packageChecks,
  caseTatHours,
} from "../src/cases/case-service-plan";
import { CreateCaseDto } from "../src/cases/dto/create-case.dto";
import type { PrismaService } from "../src/database/prisma.service";
import type { Actor } from "../src/common/auth/actor";

const actor = { tenantId: 1n, clientId: 2n, roles: ["CLIENT_ADMIN"] } as Actor;
const ids = [
  "f45c1fc8-20a8-47a2-a71f-f2a197a2a100",
  "f45c1fc8-20a8-47a2-a71f-f2a197a2a101",
];
const packages = ids.map((publicId, index) => ({
  id: BigInt(index + 10),
  publicId,
  name: `Service ${index}`,
  code: `S${index}`,
  serviceFamily: index ? "VENDORCHECK" : "HIRECHECK",
  checksJson: '["IDENTITY"]',
  requiredDocumentsJson: '["PAN"]',
  tatHours: 72,
  price: 900,
}));
const input = {
  clientId: ids[0],
  servicePackageId: ids[0],
  fullName: "Test Contact",
  email: "test@example.invalid",
  priority: "NORMAL",
};
function db(rates: unknown[] = []) {
  return {
    client: {
      findFirst: () =>
        Promise.resolve({
          id: 2n,
          slaHours: 120,
          version: 1,
          packageRates: rates,
        }),
    },
    servicePackage: {
      findMany: (args: { where: { publicId: { in: string[] } } }) =>
        Promise.resolve(
          packages.filter((pkg) =>
            args.where.publicId.in.includes(pkg.publicId),
          ),
        ),
    },
  } as unknown as PrismaService;
}

void test("multiple service DTO validates nested inputs and rejects malformed UUIDs", async () => {
  const value = plainToInstance(CreateCaseDto, {
    ...input,
    services: [{ servicePackageId: ids[0] }, { servicePackageId: "bad" }],
  });
  assert.ok(
    (await validate(value)).some((error) => error.property === "services"),
  );
});
void test("case service plan snapshots contracted price and tighter TAT", async () => {
  const result = await loadCaseServicePlan(
    db([
      {
        servicePackageId: 10n,
        active: true,
        unitPrice: 750,
        taxRate: 18,
        tatHours: 48,
      },
    ]),
    actor,
    input as CreateCaseDto,
  );
  assert.equal(result.services[0]!.unitPrice, 750);
  assert.equal(result.services[0]!.tatHours, 48);
  assert.equal(result.services[0]!.taxRate, 18);
});
void test("configured client entitlements reject unagreed packages", async () => {
  await assert.rejects(
    loadCaseServicePlan(
      db([{ servicePackageId: 11n, active: true }]),
      actor,
      input as CreateCaseDto,
    ),
    /not enabled/,
  );
});
void test("duplicate services and incomplete vendor details fail before creation", async () => {
  await assert.rejects(
    loadCaseServicePlan(db(), actor, {
      ...input,
      services: [{ servicePackageId: ids[0]! }, { servicePackageId: ids[0]! }],
    } as CreateCaseDto),
    /different packages/,
  );
  await assert.rejects(
    loadCaseServicePlan(db(), actor, {
      ...input,
      servicePackageId: ids[1],
    } as CreateCaseDto),
    /VendorCheck requires/,
  );
});
void test("specialised checks retain identity and unsupported types cannot enter a package", () => {
  assert.deepEqual(
    packageChecks('["MCA_VALIDATION","CONFLICT_OF_INTEREST","WRONG"]'),
    ["MCA_VALIDATION", "CONFLICT_OF_INTEREST"],
  );
  assert.equal(caseTatHours("URGENT", 72, 48), 24);
});
