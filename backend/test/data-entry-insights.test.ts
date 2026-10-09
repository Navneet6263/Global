import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import {
  DataEntryInsightsService,
  istDayStart,
} from "../src/workflow/data-entry-insights.service";

const now = new Date("2026-10-08T06:30:00Z"); // Thu 8 Oct, 12:00 IST
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

const operator = {
  tenantId: 1n,
  userId: 41n,
  roles: ["DATA_ENTRY"],
  departments: [],
} as unknown as Actor;
const lead = {
  ...operator,
  departments: [{ id: 7n, kind: "DATA_ENTRY", role: "LEAD" }],
} as unknown as Actor;

function fakePrisma() {
  const wheres: unknown[] = [];
  const audits: Array<{ action: string; afterJson: string }> = [];
  const ready = [
    {
      dataEntryReadyAt: hoursAgo(1),
      dataEntryAssignedAt: hoursAgo(5),
      dataEntryUser: { publicId: "u-1", displayName: "Asha" },
    },
    {
      dataEntryReadyAt: hoursAgo(26),
      dataEntryAssignedAt: hoursAgo(28),
      dataEntryUser: { publicId: "u-2", displayName: "Ravi" },
    },
  ];
  const prisma = {
    verificationCase: {
      count: (args: { where: { intakeStage: string } }) => {
        wheres.push(args.where);
        return args.where.intakeStage === "DATA_ENTRY" ? 3 : 1;
      },
      findMany: (args: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
      }) => {
        wheres.push(args.where);
        if ("dueAt" in args.select)
          return [
            {
              dueAt: hoursAgo(2),
              client: { displayName: "Acme" },
              dataEntryUser: { publicId: "u-1", displayName: "Asha" },
            },
            {
              dueAt: null,
              client: { displayName: "Acme" },
              dataEntryUser: { publicId: "u-1", displayName: "Asha" },
            },
            {
              dueAt: null,
              client: { displayName: "Globex" },
              dataEntryUser: { publicId: "u-2", displayName: "Ravi" },
            },
          ];
        if ("caseNumber" in args.select && "checks" in args.select)
          return [
            {
              caseNumber: "SG-1",
              intakeStage: "READY",
              dataEntryAssignedAt: hoursAgo(5),
              dataEntryReadyAt: hoursAgo(1),
              client: { displayName: "=Acme" },
              subject: { fullName: "Neha, Rao" },
              dataEntryUser: { displayName: "Asha" },
              checks: [{ initiatedAt: hoursAgo(1) }, { initiatedAt: null }],
              _count: { clarifications: 1 },
            },
          ];
        if ("publicId" in args.select) return [];
        return ready;
      },
    },
    clarification: {
      count: (args: { where: unknown }) => {
        wheres.push(args.where);
        return 2;
      },
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  } as unknown as PrismaService;
  return { prisma, wheres, audits };
}

void test("IST day start is midnight in India", () => {
  assert.equal(istDayStart(now).toISOString(), "2026-10-07T18:30:00.000Z");
  assert.equal(istDayStart(now, 1).toISOString(), "2026-10-06T18:30:00.000Z");
});

void test("overview counts my queue, ready today / week, turnaround and L1s", async () => {
  const { prisma, wheres } = fakePrisma();
  const result = await new DataEntryInsightsService(prisma).overview(
    operator,
    "team",
    now,
  );
  assert.equal(
    result.scope,
    "mine",
    "a non-lead only ever sees their own work",
  );
  assert.equal(result.canSeeTeam, false);
  assert.deepEqual(result.kpis, {
    inQueue: 3,
    corrections: 1,
    overdue: 1,
    readyToday: 1,
    readyThisWeek: 2,
    readyThisMonth: 2,
    averageTurnaroundHours: 3,
    l1Raised30d: 2,
  });
  assert.equal(result.trend.length, 14);
  assert.equal(result.trend.at(-1)?.ready, 1);
  assert.deepEqual(result.pendingByClient[0], { client: "Acme", count: 2 });
  assert.deepEqual(result.team, []);
  assert.ok(
    JSON.stringify(wheres, (_k, v: unknown) =>
      typeof v === "bigint" ? `${v}n` : v,
    ).includes('"dataEntryUserId":"41n"'),
  );
});

void test("a Data Entry Team Leader sees the team table", async () => {
  const { prisma } = fakePrisma();
  const result = await new DataEntryInsightsService(prisma).overview(
    lead,
    "team",
    now,
  );
  assert.equal(result.scope, "team");
  assert.deepEqual(result.team, [
    { name: "Asha", inQueue: 2, readyThisWeek: 1 },
    { name: "Ravi", inQueue: 1, readyThisWeek: 1 },
  ]);
});

void test("other roles cannot open the Data Entry numbers", async () => {
  const { prisma } = fakePrisma();
  const rm = { ...operator, roles: ["SPOC_RM"] };
  await assert.rejects(
    new DataEntryInsightsService(prisma).overview(rm),
    /Data Entry workspace/,
  );
});

void test("report export keeps only the picked columns, is CSV-safe and audited", async () => {
  const { prisma, audits } = fakePrisma();
  const service = new DataEntryInsightsService(prisma);
  const preview = await service.report(operator, {
    from: "2026-10-01",
    to: "2026-10-08",
  });
  assert.equal(preview.summary.markedReady, 1);
  assert.equal(preview.summary.averageTurnaroundHours, 4);
  const file = await service.exportCsv(operator, {
    from: "2026-10-01",
    to: "2026-10-08",
    columns: "caseNumber,client,candidate,checksInitiated,bogus",
  });
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  assert.equal(text.charCodeAt(0), 0xfeff, "Excel-friendly BOM");
  const csv = text.slice(1);
  assert.equal(
    csv,
    `Sapling ID,Company,Candidate,Checks initiated\r\nSG-1,'=Acme,"Neha, Rao",1`,
  );
  assert.equal(audits[0]?.action, "data-entry.report-exported");
  await assert.rejects(
    service.report(operator, { from: "2026-10-09", to: "2026-10-01" }),
    /valid date range/,
  );
});
