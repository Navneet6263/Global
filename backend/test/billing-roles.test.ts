import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { passwordExpired } from "../src/auth/password-expiry";
import { BillingAnnexureAgeingService } from "../src/finance/billing-annexure-ageing.service";
import { BillingAnnexureService } from "../src/finance/billing-annexure.service";
import {
  CustomRolesService,
  customRoleCode,
} from "../src/users/custom-roles.service";

const decimal = (value: number) => ({ toFixed: () => value.toFixed(2) });
const now = new Date("2026-10-07T06:00:00Z");

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 4n,
    publicId: "inv-1",
    invoiceNumber: "INV-2026-10",
    status: "ISSUED",
    issuedAt: now,
    subtotal: decimal(1000),
    taxAmount: decimal(180),
    totalAmount: decimal(1180),
    annexureStatus: null,
    annexureSentAt: null,
    annexureValidatedAt: null,
    annexureQuery: null,
    clientId: 9n,
    client: { displayName: "Vision India" },
    lines: [
      {
        description: "HireCheck package",
        quantity: 1,
        unitPrice: decimal(1000),
        taxRate: decimal(18),
        lineTotal: decimal(1000),
        report: { releasedAt: now },
        case: {
          caseNumber: "SG-1",
          completedAt: now,
          subject: { fullName: "Aarav Sharma" },
          checks: [{ result: "DISCREPANCY", disposition: "YELLOW" }],
        },
      },
    ],
    ...overrides,
  };
}

function annexureFixture(row: ReturnType<typeof invoice>) {
  const updates: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const notices: string[] = [];
  const tx = {
    invoice: {
      update: (args: { data: Record<string, unknown> }) =>
        updates.push(args.data),
    },
    user: {
      findMany: (args: { where: { clientId?: bigint } }) =>
        args.where.clientId
          ? [{ id: 1n, email: "admin@client.test" }]
          : [{ id: 2n }],
    },
    notification: {
      createMany: (args: { data: Array<{ title: string }> }) =>
        notices.push(args.data[0]!.title),
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    invoice: {
      findFirst: (args: { where: Record<string, unknown> }) => {
        if (args.where.clientId !== undefined)
          assert.equal(args.where.clientId, 9n, "client scope");
        return row;
      },
    },
    auditEvent: tx.auditEvent,
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return {
    service: new BillingAnnexureService(prisma),
    updates,
    audits,
    notices,
  };
}

const finance = {
  tenantId: 1n,
  userId: 3n,
  roles: ["FINANCE_MANAGER"],
} as Actor;
const client = {
  tenantId: 1n,
  userId: 5n,
  roles: ["CLIENT_ADMIN"],
  clientId: 9n,
} as Actor;

void test("billing annexure lists each billed case with its colour code", async () => {
  const { service } = annexureFixture(invoice());
  const result = await service.annexure(finance, "inv-1", now);
  assert.equal(result.rows[0]!.colourLabel, "Minor discrepancy");
  assert.deepEqual(result.colours, { YELLOW: 1 });
  assert.equal(result.invoice.totalAmount, "1180.00");
});

void test("finance sends the annexure and the company is asked to validate", async () => {
  const { service, updates, audits, notices } = annexureFixture(invoice());
  await service.send(finance, "inv-1", now);
  assert.equal(updates[0]!.annexureStatus, "PENDING");
  assert.deepEqual(updates[0]!.annexureSentAt, now);
  assert.deepEqual(notices, ["Please validate bill INV-2026-10"]);
  assert.deepEqual(audits, ["finance.annexure-sent"]);
});

void test("a draft invoice cannot send its annexure", async () => {
  const { service } = annexureFixture(invoice({ status: "DRAFT" }));
  await assert.rejects(
    service.send(finance, "inv-1", now),
    /Issue the invoice/,
  );
});

void test("the company validates the bill or raises a query, and Finance is told", async () => {
  const validate = annexureFixture(invoice({ annexureStatus: "PENDING" }));
  await validate.service.validate(client, "inv-1", now);
  assert.equal(validate.updates[0]!.annexureStatus, "VALIDATED");
  assert.deepEqual(validate.audits, ["finance.annexure-validated"]);
  const query = annexureFixture(invoice({ annexureStatus: "PENDING" }));
  await query.service.query(client, "inv-1", "Case SG-1 was cancelled by us");
  assert.equal(query.updates[0]!.annexureStatus, "QUERIED");
  assert.equal(
    query.updates[0]!.annexureQuery,
    "Case SG-1 was cancelled by us",
  );
  assert.deepEqual(query.notices, ["Bill INV-2026-10"]);
  const done = annexureFixture(invoice({ annexureStatus: "VALIDATED" }));
  await assert.rejects(
    done.service.validate(client, "inv-1"),
    /no bill waiting/,
  );
});

void test("an annexure unvalidated for 3 days raises one ageing alert a day", async () => {
  const audits: string[] = [];
  const sentAt = new Date(now.getTime() - 4 * 86_400_000);
  let previous: Array<{ createdAt: Date }> = [];
  const tx = {
    auditEvent: {
      findMany: () => previous,
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    invoice: {
      findMany: () => [
        {
          id: 4n,
          publicId: "inv-1",
          tenantId: 1n,
          clientId: 9n,
          invoiceNumber: "INV-2026-10",
          annexureSentAt: sentAt,
          client: { displayName: "Vision India" },
        },
      ],
    },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const notified: string[] = [];
  const annexure = {
    notifyClient: () => (notified.push("client"), 1),
    notifyFinance: () => (notified.push("finance"), 1),
  } as unknown as BillingAnnexureService;
  const worker = new BillingAnnexureAgeingService(
    prisma,
    { get: () => undefined } as unknown as ConfigService,
    annexure,
  );
  assert.equal(await worker.run(now), 1);
  assert.deepEqual(notified, ["client", "finance"]);
  assert.deepEqual(audits, ["finance.annexure-ageing-alert"]);
  previous = [{ createdAt: new Date(now.getTime() - 3_600_000) }];
  assert.equal(await worker.run(now), 0, "not twice in a day");
});

void test("passwords expire after 90 days unless the policy is off", () => {
  const changed = new Date(now.getTime() - 90 * 86_400_000);
  assert.equal(passwordExpired(changed, 90, now), true);
  assert.equal(
    passwordExpired(new Date(now.getTime() - 89 * 86_400_000), 90, now),
    false,
  );
  assert.equal(passwordExpired(changed, 0, now), false);
});

function rolesFixture() {
  const created: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const roleRows: Record<string, unknown> = {
    VERIFIER: {
      code: "VERIFIER",
      name: "Verifier",
      permissionsJson: JSON.stringify(["task:read", "task:write", "case:read"]),
    },
  };
  const tx = {
    role: {
      create: (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { publicId: "role-1", code: args.data.code };
      },
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    role: {
      findFirst: (args: {
        where: { code?: string; isSystem?: boolean; publicId?: string };
      }) => {
        if (args.where.isSystem) return roleRows[args.where.code ?? ""] ?? null;
        if (args.where.publicId === "system-role")
          return {
            id: 1n,
            code: "VERIFIER",
            name: "Verifier",
            isSystem: true,
            baseRoleCode: null,
            permissionsJson: "[]",
          };
        return null;
      },
    },
    userRole: { count: () => 0 },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return { service: new CustomRolesService(prisma), created, audits };
}

const admin = { tenantId: 1n, userId: 1n, roles: ["PLATFORM_ADMIN"] } as Actor;

void test("a custom role narrows its base role's permissions and is audited", async () => {
  const { service, created, audits } = rolesFixture();
  const result = await service.create(admin, {
    name: "Senior verifier (read only)",
    baseRoleCode: "VERIFIER",
    permissions: ["case:read", "task:read"],
  });
  assert.equal(result.code, "CUSTOM_SENIOR_VERIFIER_READ_ONLY");
  assert.equal(created[0]!.baseRoleCode, "VERIFIER");
  assert.equal(created[0]!.isSystem, false);
  assert.equal(
    created[0]!.permissionsJson,
    JSON.stringify(["case:read", "task:read"]),
  );
  assert.deepEqual(audits, ["role.custom-created"]);
});

void test("a custom role cannot gain permissions, use an admin base, or touch system roles", async () => {
  const { service } = rolesFixture();
  await assert.rejects(
    service.create(admin, {
      name: "Sneaky verifier",
      baseRoleCode: "VERIFIER",
      permissions: ["task:read", "user:write"],
    }),
    /cannot add permissions/,
  );
  await assert.rejects(
    service.create(admin, {
      name: "Mini admin",
      baseRoleCode: "PLATFORM_ADMIN",
      permissions: ["*"],
    }),
    /supported base role/,
  );
  await assert.rejects(service.remove(admin, "system-role"), /System roles/);
  assert.equal(customRoleCode("  QC – night shift "), "CUSTOM_QC_NIGHT_SHIFT");
});
