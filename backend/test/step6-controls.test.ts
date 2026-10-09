import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import {
  caseColour,
  defaultDisposition,
  resolveDisposition,
} from "../src/verification/dispositions";
import {
  calendarFromEnv,
  dueAlerts,
  waitingStage,
  workingMinutesBetween,
} from "../src/workflow/stage-alerts";
import { ClientRmService } from "../src/workflow/client-rm.service";
import { CaseHoldService } from "../src/workflow/case-hold.service";
import { StageAlertService } from "../src/workflow/stage-alert.service";

const UUID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ops: Actor = {
  userId: 10n,
  userPublicId: UUID(10),
  tenantId: 1n,
  tenantPublicId: UUID(1),
  tenantName: "Sapling Global",
  email: "ops@example.invalid",
  displayName: "Ananya Rao",
  mustChangePassword: false,
  roles: ["OPS_MANAGER"],
  permissions: ["*"],
};

void test("dispositions: defaults from the result, reject contradictions, case takes the worst", () => {
  assert.equal(defaultDisposition("CLEAR"), "GREEN");
  assert.equal(defaultDisposition("DISCREPANCY"), "RED");
  assert.equal(defaultDisposition("UNABLE_TO_VERIFY"), "AMBER");
  assert.equal(resolveDisposition("DISCREPANCY", "YELLOW"), "YELLOW");
  assert.equal(resolveDisposition("CLEAR", "BLUE"), "BLUE");
  assert.throws(() => resolveDisposition("CLEAR", "RED"), BadRequestException);
  assert.throws(
    () => resolveDisposition("UNABLE_TO_VERIFY", "GREEN"),
    BadRequestException,
  );
  assert.equal(
    caseColour([
      { result: "CLEAR", disposition: "BLUE" },
      { result: "DISCREPANCY", disposition: "YELLOW" },
    ]),
    "YELLOW",
  );
  assert.equal(
    caseColour([{ result: "CLEAR" }, { result: "DISCREPANCY" }]),
    "RED",
  );
  assert.equal(caseColour([{ result: null }]), null);
});

void test("working minutes count only open hours on working days (IST)", () => {
  // Monday 09:30 IST = 04:00 UTC; Monday 18:30 IST = 13:00 UTC.
  const mondayOpen = new Date("2026-10-05T04:00:00Z");
  assert.equal(
    workingMinutesBetween(mondayOpen, new Date("2026-10-05T13:00:00Z")),
    540,
  );
  // Saturday 18:00 IST to Monday 10:30 IST: 30 min Saturday + Sunday off + 60 min Monday.
  assert.equal(
    workingMinutesBetween(
      new Date("2026-10-10T12:30:00Z"),
      new Date("2026-10-12T05:00:00Z"),
    ),
    90,
  );
  // Overnight outside hours counts nothing.
  assert.equal(
    workingMinutesBetween(
      new Date("2026-10-05T14:00:00Z"),
      new Date("2026-10-05T23:00:00Z"),
    ),
    0,
  );
  const fiveDay = calendarFromEnv("1-5", "10:00-19:00");
  assert.deepEqual(
    [fiveDay.days, fiveDay.openMinute, fiveDay.closeMinute],
    [[1, 2, 3, 4, 5], 600, 1140],
  );
  assert.deepEqual(
    calendarFromEnv("bad", "25:00-26:00").days,
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(dueAlerts(mondayOpen, new Date("2026-10-05T10:00:00Z")), [
    "RED",
  ]);
  assert.deepEqual(dueAlerts(mondayOpen, new Date("2026-10-05T12:30:00Z")), [
    "RED",
    "HOD",
  ]);
});

void test("waiting stages are internal only; corrections wait on the client", () => {
  const base = {
    status: "DOCUMENT_PENDING",
    workflowVersion: 2,
    intakeStage: "DATA_ENTRY",
    assignedOpsUserId: 5n,
    dataEntryAssignedAt: new Date("2026-10-05T05:00:00Z"),
    dataEntryReadyAt: null,
    createdAt: new Date("2026-10-04T05:00:00Z"),
    documentPendingSince: new Date("2026-10-04T06:00:00Z"),
    oldestUnassignedRoutedAt: null,
  };
  assert.equal(waitingStage(base)?.stage, "DATA_ENTRY");
  assert.equal(
    waitingStage({ ...base, assignedOpsUserId: null })?.stage,
    "NEEDS_RM",
  );
  assert.equal(waitingStage({ ...base, intakeStage: "CORRECTION" }), null);
  assert.equal(
    waitingStage({
      ...base,
      status: "IN_PROGRESS",
      intakeStage: "ROUTED",
      oldestUnassignedRoutedAt: new Date(),
    })?.stage,
    "TEAM_ASSIGNMENT",
  );
  assert.equal(waitingStage({ ...base, status: "QA_REVIEW" }), null);
});

function recorder() {
  const writes: Array<{ kind: string; data: unknown }> = [];
  const record =
    (kind: string, result: unknown = { count: 1 }) =>
    (input: unknown) => {
      writes.push({ kind, data: input });
      return Promise.resolve(result);
    };
  return { writes, record };
}

void test("company RM: scope added, open unassigned cases moved, every move audited", async () => {
  const { writes, record } = recorder();
  const tx = {
    client: { updateMany: record("client.update") },
    spocClientScope: {
      findUnique: () => Promise.resolve(null),
      create: record("scope.create"),
    },
    verificationCase: {
      findMany: (input: unknown) => {
        writes.push({ kind: "cases.find", data: input });
        return Promise.resolve([
          {
            id: 1n,
            publicId: UUID(101),
            caseNumber: "SG-1",
            assignedOpsUserId: null,
          },
          {
            id: 2n,
            publicId: UUID(102),
            caseNumber: "SG-2",
            assignedOpsUserId: null,
          },
        ]);
      },
      updateMany: record("cases.update"),
    },
    auditEvent: { create: record("audit"), createMany: record("auditMany") },
    notification: { create: record("notify") },
  };
  const prisma = {
    client: {
      findFirst: () =>
        Promise.resolve({
          id: 40n,
          displayName: "Horizon Tech",
          version: 2,
          primaryRmUserId: null,
          primaryRm: null,
        }),
    },
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 60n,
          publicId: UUID(60),
          displayName: "Riya Mehta",
        }),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const result = await new ClientRmService(prisma).assign(ops, UUID(40), {
    rmUserId: UUID(60),
    version: 2,
    apply: "UNASSIGNED",
  });
  assert.equal(result.casesMoved, 2);
  assert.ok(writes.some((w) => w.kind === "scope.create"));
  const find = writes.find((w) => w.kind === "cases.find")?.data as {
    where: Record<string, unknown>;
  };
  assert.equal(find.where.assignedOpsUserId, null);
  const audits = writes.find((w) => w.kind === "auditMany")?.data as {
    data: Array<{ action: string }>;
  };
  assert.deepEqual(
    audits.data.map((a) => a.action),
    ["case.owner-assigned", "case.owner-assigned"],
  );
  const summary = writes
    .filter((w) => w.kind === "audit")
    .map((w) => (w.data as { data: { action: string } }).data.action);
  assert.deepEqual(summary, [
    "user.client-scope-added",
    "client.primary-rm-assigned",
  ]);

  const stale = {
    ...prisma,
    client: {
      findFirst: () =>
        Promise.resolve({
          id: 40n,
          displayName: "Horizon Tech",
          version: 3,
          primaryRmUserId: null,
          primaryRm: null,
        }),
    },
  } as unknown as PrismaService;
  await assert.rejects(
    new ClientRmService(stale).assign(ops, UUID(40), {
      rmUserId: UUID(60),
      version: 2,
    }),
    ConflictException,
  );

  // A database allowing one SPOC scope per client rejects a second RM with a clear 409.
  const oneScope = {
    ...prisma,
    $transaction: (work: (client: typeof tx) => Promise<unknown>) =>
      work({
        ...tx,
        spocClientScope: {
          findUnique: () => Promise.resolve(null),
          create: () =>
            Promise.reject(
              Object.assign(new Error("unique"), { code: "P2002" }),
            ),
        },
      }),
  } as unknown as PrismaService;
  await assert.rejects(
    new ClientRmService(oneScope).assign(ops, UUID(40), {
      rmUserId: UUID(60),
      version: 2,
    }),
    /already mapped to another RM/,
  );
});

void test("STOP and resume: only live work, back to the same status, client and RM told", async () => {
  const { writes, record } = recorder();
  const row = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 30n,
    publicId: UUID(30),
    caseNumber: "SG-STOP",
    status,
    version: 4,
    clientId: 40n,
    assignedOpsUserId: 60n,
    stoppedFromStatus: null,
    stoppedAt: null,
    stopReason: null,
    ...extra,
  });
  let current = row("IN_PROGRESS");
  const tx = {
    verificationCase: { updateMany: record("case.update") },
    caseStatusHistory: { create: record("history") },
    auditEvent: { create: record("audit") },
    user: { findMany: () => Promise.resolve([{ id: 70n }]) },
    notification: { createMany: record("notifyMany") },
  };
  const prisma = {
    verificationCase: { findFirst: () => Promise.resolve(current) },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const service = new CaseHoldService(prisma);
  const stopped = await service.stop(ops, UUID(30), {
    version: 4,
    reason: "Client withdrew the offer",
  });
  assert.equal(stopped.status, "STOPPED");
  const update = writes.find((w) => w.kind === "case.update")?.data as {
    data: Record<string, unknown>;
  };
  assert.equal(update.data.stoppedFromStatus, "IN_PROGRESS");
  const told = writes.find((w) => w.kind === "notifyMany")?.data as {
    data: Array<{ userId: bigint }>;
  };
  assert.deepEqual(
    told.data.map((n) => n.userId),
    [70n, 60n],
  );

  current = row("STOPPED", { stoppedFromStatus: "IN_PROGRESS", version: 5 });
  const resumed = await service.resume(ops, UUID(30), { version: 5 });
  assert.equal(resumed.status, "IN_PROGRESS");

  current = row("MANAGER_REVIEW");
  await assert.rejects(
    service.stop(ops, UUID(30), { version: 4, reason: "Too late" }),
    ConflictException,
  );
  current = row("IN_PROGRESS");
  const otherRm: Actor = { ...ops, userId: 99n, roles: ["SPOC_RM"] };
  await assert.rejects(
    service.stop(otherRm, UUID(30), { version: 4, reason: "Not my case" }),
    ForbiddenException,
  );
});

void test("stage alerts fire once per step and level, to the owners and Operations", async () => {
  const { writes, record } = recorder();
  let alreadySent = 0;
  const tx = {
    $queryRaw: () => Promise.resolve([{ result: 0 }]),
    auditEvent: {
      count: () => Promise.resolve(alreadySent),
      create: record("audit"),
    },
    notification: { createMany: record("notifyMany") },
    departmentMember: { findMany: () => Promise.resolve([{ userId: 81n }]) },
    user: {
      findMany: (input: {
        where: { userRoles: { some: { role: { code: string } } } };
      }) =>
        Promise.resolve(
          input.where.userRoles.some.role.code === "PLATFORM_ADMIN"
            ? [{ id: 90n }]
            : [{ id: 10n }],
        ),
    },
  };
  const prisma = {
    verificationCase: {
      findMany: () =>
        Promise.resolve([
          {
            id: 1n,
            publicId: UUID(30),
            caseNumber: "SG-WAIT",
            tenantId: 1n,
            branchId: null,
            clientId: 40n,
            status: "DOCUMENT_PENDING",
            workflowVersion: 2,
            intakeStage: "DATA_ENTRY",
            assignedOpsUserId: 60n,
            dataEntryUserId: 70n,
            dataEntryAssignedAt: new Date("2026-10-05T04:00:00Z"),
            dataEntryReadyAt: null,
            createdAt: new Date("2026-10-04T04:00:00Z"),
            statusHistory: [],
            checks: [],
          },
        ]),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const config = {
    get: (_key: string, fallback: unknown) => fallback,
  } as unknown as ConfigService;
  const service = new StageAlertService(prisma, config);
  // Monday 09:30 -> Monday 17:00 IST = 7.5 working hours: RED only.
  const sent = await service.run(new Date("2026-10-05T11:30:00Z"));
  const recipients = (
    writes.find((w) => w.kind === "notifyMany")?.data as {
      data: Array<{ userId: bigint; type: string }>;
    }
  ).data;
  assert.deepEqual(recipients.map((r) => r.userId).sort(), [
    10n,
    60n,
    70n,
    81n,
  ]);
  assert.ok(recipients.every((r) => r.type === "STAGE_ALERT_RED"));
  assert.equal(sent, 4);
  alreadySent = 1;
  writes.length = 0;
  assert.equal(await service.run(new Date("2026-10-05T11:30:00Z")), 0);
  assert.equal(writes.length, 0);
});
