import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { crc32, storeZip } from "../src/common/zip/store-zip";
import type { PrismaService } from "../src/database/prisma.service";
import {
  misCsv,
  misRows,
  nextMisRun,
  type MisCase,
} from "../src/reports/client-mis";
import {
  CheckReworkService,
  periodStart,
} from "../src/workflow/check-rework.service";

const day = (iso: string) => new Date(iso);

const cases: MisCase[] = [
  {
    caseNumber: "SG-1",
    status: "COMPLETED",
    createdAt: day("2026-10-01T05:00:00Z"),
    completedAt: day("2026-10-05T05:00:00Z"),
    dueAt: day("2026-10-08T05:00:00Z"),
    subject: { fullName: "Aarav Sharma" },
    checks: [
      {
        type: "EMPLOYMENT",
        result: "DISCREPANCY",
        disposition: "RED",
        sourceSummary: "Tenure mismatch confirmed by HR",
        completedAt: day("2026-10-04T05:00:00Z"),
      },
      {
        type: "EDUCATION",
        result: "UNABLE_TO_VERIFY",
        disposition: null,
        sourceSummary: "University closed",
        completedAt: day("2026-10-04T05:00:00Z"),
      },
    ],
  },
  {
    caseNumber: "SG-2",
    status: "IN_PROGRESS",
    createdAt: day("2026-09-20T05:00:00Z"),
    completedAt: null,
    dueAt: day("2026-09-30T05:00:00Z"),
    subject: { fullName: "Neha Gupta" },
    checks: [
      {
        type: "ADDRESS",
        result: "UNABLE_TO_VERIFY",
        disposition: null,
        sourceSummary: "Internal: house locked, neighbour hostile",
        completedAt: null,
      },
    ],
  },
];

void test("case status MIS shows colour only after release", () => {
  const rows = misRows("CASE_STATUS", cases);
  assert.equal(rows[0]!.colour, "RED");
  assert.equal(rows[0]!.cells[6], "Major discrepancy");
  assert.equal(rows[1]!.colour, null);
  assert.equal(rows[1]!.cells[5], "1/1");
});

void test("TAT MIS flags late open cases", () => {
  const rows = misRows("TAT", cases, day("2026-10-07T05:00:00Z"));
  assert.deepEqual(rows[0]!.cells.slice(5), ["4", "Yes"]);
  assert.equal(rows[0]!.colour, "GREEN");
  assert.deepEqual(rows[1]!.cells.slice(5), ["17", "No (open)"]);
  assert.equal(rows[1]!.colour, "RED");
});

void test("UTV and discrepancy MIS never leak remarks before the report is released", () => {
  const utv = misRows("UTV", cases);
  assert.equal(utv.length, 2);
  assert.equal(utv[0]!.cells[4], "University closed");
  assert.equal(utv[1]!.cells[4], "Under review — shared with the report");
  assert.equal(JSON.stringify(utv).includes("hostile"), false);
  const discrepancy = misRows("DISCREPANCY", cases);
  assert.equal(discrepancy.length, 1);
  assert.equal(discrepancy[0]!.cells[3], "Major discrepancy");
});

void test("MIS CSV neutralises spreadsheet formulas", () => {
  const csv = misCsv("UTV", [{ cells: ["=HYPERLINK()", "a,b"] }]);
  assert.match(csv, /'=HYPERLINK\(\),"a,b"/);
});

void test("scheduled MIS runs at 08:00 IST: tomorrow, next Monday, 1st of next month", () => {
  const wednesday = day("2026-10-07T10:00:00Z"); // Wed 15:30 IST
  assert.equal(
    nextMisRun("DAILY", wednesday).toISOString(),
    "2026-10-08T02:30:00.000Z",
  );
  assert.equal(
    nextMisRun("WEEKLY", wednesday).toISOString(),
    "2026-10-12T02:30:00.000Z",
  );
  assert.equal(
    nextMisRun("MONTHLY", wednesday).toISOString(),
    "2026-11-01T02:30:00.000Z",
  );
});

void test("bulk ZIP is a valid stored archive", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const zip = storeZip([
    { name: "index.csv", data: Buffer.from("a,b") },
    { name: "SG-1.pdf", data: Buffer.from("%PDF-1.7") },
  ]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), 2);
  const centralAt = zip.readUInt32LE(end + 16);
  assert.equal(zip.readUInt32LE(centralAt), 0x02014b50);
});

void test("annexure periods start on IST Monday, the 1st, and 1 January", () => {
  const now = day("2026-10-07T10:00:00Z");
  assert.equal(
    periodStart("week", now).toISOString(),
    "2026-10-04T18:30:00.000Z",
  );
  assert.equal(
    periodStart("month", now).toISOString(),
    "2026-09-30T18:30:00.000Z",
  );
  assert.equal(
    periodStart("year", now).toISOString(),
    "2025-12-31T18:30:00.000Z",
  );
});

function reworkFixture(check: Record<string, unknown>) {
  const writes: string[] = [];
  const audits: Array<{ action: string; afterJson: string }> = [];
  const tx = {
    caseCheck: {
      findFirst: () => ({
        id: 3n,
        type: "EDUCATION",
        status: "COMPLETED",
        result: "UNABLE_TO_VERIFY",
        dueAt: null,
        caseId: 2n,
        case: { publicId: "case-1", caseNumber: "SG-1", status: "IN_PROGRESS" },
        tasks: [{ id: 8n, assigneeId: 5n, status: "COMPLETED" }],
        ...check,
      }),
      update: (args: { data: { status: string } }) =>
        writes.push(`check:${args.data.status}`),
      findMany: () => [],
    },
    verificationMethodRun: {
      findMany: () => [],
      updateMany: () => ({ count: 0 }),
    },
    checkTask: {
      create: (args: { data: { status: string } }) => {
        writes.push(`task:${args.data.status}`);
        return { publicId: "task-2" };
      },
      update: () => ({ publicId: "task-1" }),
    },
    verificationCase: {
      findUnique: () => ({ id: 2n, checks: [] }),
      update: () => ({}),
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return { service: new CheckReworkService(prisma), writes, audits };
}

const ops = { tenantId: 1n, userId: 2n, roles: ["OPS_MANAGER"] } as Actor;

void test("re-open sends the UTV check back to the same verifier, audited with the reason", async () => {
  const { service, writes, audits } = reworkFixture({});
  const result = await service.rework(
    ops,
    "check-1",
    "REOPEN",
    "New HR contact received",
  );
  assert.equal(result.assigned, true);
  assert.deepEqual(writes, ["check:ASSIGNED", "task:OPEN"]);
  assert.equal(audits.at(-1)!.action, "check.utv-reopened");
  assert.match(audits.at(-1)!.afterJson, /New HR contact received/);
});

void test("re-initiate returns the check to the allocation pool", async () => {
  const { service, writes, audits } = reworkFixture({});
  const result = await service.rework(
    ops,
    "check-1",
    "REINITIATE",
    "Client sent new details",
  );
  assert.equal(result.assigned, false);
  assert.deepEqual(writes, ["check:PENDING", "task:UNASSIGNED"]);
  assert.equal(audits.at(-1)!.action, "check.utv-reinitiated");
});

void test("rework is refused for closed cases, non-UTV checks and plain verifiers", async () => {
  await assert.rejects(
    reworkFixture({
      case: { publicId: "c", caseNumber: "SG", status: "COMPLETED" },
    }).service.rework(ops, "c", "REOPEN", "Please look again"),
    /case is closed/,
  );
  await assert.rejects(
    reworkFixture({ result: "CLEAR" }).service.rework(
      ops,
      "c",
      "REOPEN",
      "Please look again",
    ),
    /Only UTV checks/,
  );
  const verifier = {
    tenantId: 1n,
    userId: 4n,
    roles: ["VERIFIER"],
    departments: [],
  } as unknown as Actor;
  await assert.rejects(
    reworkFixture({}).service.rework(
      verifier,
      "c",
      "REJECT",
      "Please look again",
    ),
    /Team Leader/,
  );
});

void test("team annexure export keeps only the chosen columns, in order, and is audited", async () => {
  const audits: Array<{ action: string; afterJson: string }> = [];
  const prisma = {
    caseCheck: {
      findMany: () => [
        {
          publicId: "chk-1",
          type: "EDUCATION",
          result: "CLEAR",
          disposition: "GREEN",
          completedAt: new Date("2026-10-05T06:30:00Z"),
          case: {
            publicId: "case-1",
            caseNumber: "SG-1",
            status: "IN_PROGRESS",
            client: { displayName: "Acme" },
            subject: { fullName: "Neha Rao" },
          },
          tasks: [{ assignee: { displayName: "Priya" } }],
        },
      ],
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  } as unknown as PrismaService;
  const file = await new CheckReworkService(prisma).annexureCsv(
    ops,
    "month",
    "verifier,caseNumber,bogus",
  );
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8").slice(1);
  assert.equal(csv.split("\r\n")[0], "Verifier,Sapling ID");
  assert.ok(csv.includes("Priya"));
  assert.deepEqual(JSON.parse(audits[0]!.afterJson).columns, [
    "verifier",
    "caseNumber",
  ]);
});
