import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { requireClientFinanceScope } from "../src/finance/client-finance.scope";
import { ClientFinanceService } from "../src/finance/client-finance.service";
import {
  ClientCommercialService,
  validateCommercial,
} from "../src/clients/client-commercial.service";
import type { UpdateCommercialDto } from "../src/clients/dto/update-commercial.dto";
import type { PrismaService } from "../src/database/prisma.service";
import type { FinanceQueryService } from "../src/finance/finance-query.service";
import type { InvoicePdfService } from "../src/finance/invoice-pdf.service";
import { ClientIntakeController } from "../src/clients/client-intake.controller";
import type { CasesService } from "../src/cases/cases.service";
import { assertClientActivation } from "../src/clients/client-activation.policy";

const clientActor = {
  tenantId: 10n,
  clientId: 20n,
  userId: 30n,
  roles: ["CLIENT_ADMIN"],
} as Actor;
const emptyCommercial: UpdateCommercialDto = {
  version: 1,
  packages: [],
  agreements: [],
};

void test("new onboarding clients cannot activate until commercial prerequisites are recorded", () => {
  assert.throws(
    () =>
      assertClientActivation({
        billingAddress: null,
        billingTerms: null,
        packageRates: [],
        agreements: [],
      }),
    /Complete onboarding/,
  );
  const now = new Date("2026-09-08T12:00:00Z");
  const ready = {
    billingAddress: "Office 4, Noida",
    billingTerms: "15 days",
    packageRates: [{ active: true }],
    agreements: ["AGREEMENT", "DPA"].map((type) => ({
      type,
      signedAt: new Date("2026-09-01"),
      files: [{ status: "APPROVED" }],
      expiresAt: new Date("2027-01-01"),
    })),
  };
  assert.doesNotThrow(() => assertClientActivation(ready, now));
  assert.throws(
    () =>
      assertClientActivation(
        {
          ...ready,
          agreements: ready.agreements.map((row) => ({
            ...row,
            expiresAt: new Date("2026-01-01"),
          })),
        },
        now,
      ),
    /signed/,
  );
});

void test("client finance refuses missing client scope and non-client roles", () => {
  assert.deepEqual(requireClientFinanceScope(clientActor), {
    tenantId: 10n,
    clientId: 20n,
  });
  assert.throws(
    () => requireClientFinanceScope({ ...clientActor, clientId: undefined }),
    ForbiddenException,
  );
  assert.throws(
    () =>
      requireClientFinanceScope({ ...clientActor, roles: ["PLATFORM_ADMIN"] }),
    ForbiddenException,
  );
});

void test("client invoice list always applies tenant/client scope and excludes internal notes", async () => {
  let query: Record<string, unknown> | undefined;
  const prisma = {
    invoice: {
      findMany: (input: Record<string, unknown>) => {
        query = input;
        return [];
      },
    },
  };
  const service = new ClientFinanceService(
    prisma as unknown as PrismaService,
    {} as FinanceQueryService,
    {} as InvoicePdfService,
  );
  await service.list(clientActor, { limit: 20, status: "OVERDUE" });
  const where = query?.["where"] as Record<string, unknown>;
  assert.equal(where["tenantId"], 10n);
  assert.equal(where["clientId"], 20n);
  assert.equal(
    (query?.["select"] as Record<string, unknown>)["notes"],
    undefined,
  );
});

void test("client invoice PDF cannot fetch another organisation invoice", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    invoice: {
      findFirst: (input: { where: Record<string, unknown> }) => {
        where = input.where;
        return null;
      },
    },
  };
  const service = new ClientFinanceService(
    prisma as unknown as PrismaService,
    {} as FinanceQueryService,
    {} as InvoicePdfService,
  );
  await assert.rejects(
    service.download(clientActor, "other-invoice"),
    NotFoundException,
  );
  assert.deepEqual(where, {
    tenantId: 10n,
    clientId: 20n,
    publicId: "other-invoice",
  });
});

void test("commercial contracts reject duplicate packages and backwards agreement dates", () => {
  const rate = {
    servicePackageId: "package",
    unitPrice: 100,
    taxRate: 18,
    active: true,
  };
  assert.throws(
    () => validateCommercial({ ...emptyCommercial, packages: [rate, rate] }),
    /only once/,
  );
  assert.throws(
    () =>
      validateCommercial({
        ...emptyCommercial,
        agreements: [
          {
            type: "DPA",
            reference: "ref",
            signedAt: "2026-09-10",
            expiresAt: "2026-09-09",
          },
        ],
      }),
    /expiry/,
  );
});

void test("commercial config rejects another tenant package before writing", async () => {
  let writes = 0;
  const prisma = {
    client: { findFirst: () => ({ id: 20n, version: 1 }) },
    servicePackage: { findMany: () => [] },
    $transaction: () => {
      writes++;
    },
  };
  const service = new ClientCommercialService(
    prisma as unknown as PrismaService,
  );
  await assert.rejects(
    service.update(clientActor, "client", {
      ...emptyCommercial,
      packages: [
        {
          servicePackageId: "foreign-package",
          unitPrice: 100,
          taxRate: 18,
          active: true,
        },
      ],
    }),
    /workspace/,
  );
  assert.equal(writes, 0);
});

void test("bulk row intake ignores submitted organisation and applies authenticated client", async () => {
  let captured: { clientId: string } | undefined;
  const cases = {
    create: (_actor: Actor, input: { clientId: string }) => {
      captured = input;
      return { id: "case" };
    },
  };
  const prisma = {
    client: {
      findFirst: () => ({
        publicId: "11111111-1111-4111-8111-111111111111",
      }),
    },
  };
  const controller = new ClientIntakeController(
    cases as unknown as CasesService,
    prisma as unknown as PrismaService,
  );
  await controller.create(clientActor, {
    clientId: "foreign",
    fullName: "Candidate One",
    email: "candidate@example.test",
    servicePackageId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(captured?.clientId, "11111111-1111-4111-8111-111111111111");
  await assert.rejects(
    controller.create({ ...clientActor, clientId: undefined }, {}),
    ForbiddenException,
  );
});
