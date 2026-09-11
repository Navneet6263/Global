import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { ConfigService } from "@nestjs/config";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/database/prisma.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { decideQaCase } from "../src/qa/qa-decision";
import { QA_REQUIRED_CHECKLIST } from "../src/qa/qa.constants";
import { ManagerReviewService } from "../src/reports/manager-review.service";
import { ReportGenerationService } from "../src/reports/report-generation.service";
import { ReportPdfService } from "../src/reports/report-pdf.service";
import { ReportsService } from "../src/reports/reports.service";
import { InvoiceIssueService } from "../src/finance/invoice-issue.service";
import { InvoicePaymentService } from "../src/finance/invoice-payment.service";
import type { InvoicePdfService } from "../src/finance/invoice-pdf.service";
import { CaseReopeningService } from "../src/reports/case-reopening.service";
import { deliveryWorkflowFixture } from "./helpers/delivery-workflow-fixture";
import { verifyCaseActivity } from "./helpers/case-activity.integration";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: { max: 1, min: 0 },
  }),
});
const tenantCode = `ROLLBACK_${randomUUID().slice(0, 12)}`;
const sentinel = new Error("ROLLBACK_SUCCESS_NO_CHANGES_COMMITTED");
const objects = new Map<string, Buffer>();
const storage = {
  put: (key: string, contents: Buffer) => {
    objects.set(key, contents);
    return Promise.resolve();
  },
  delete: (key: string) => {
    objects.delete(key);
    return Promise.resolve();
  },
  auditedStream: async (key: string, audit: () => Promise<unknown>) => {
    const contents = objects.get(key);
    if (!contents) throw new Error("Synthetic report object missing");
    await audit();
    return Readable.from(contents);
  },
} as unknown as LocalObjectStorageService;

async function run(tx: Prisma.TransactionClient) {
  const db = new Proxy(tx, {
    get(target, property) {
      if (property === "$transaction")
        return (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          work(tx);
      return Reflect.get(target, property);
    },
  }) as unknown as PrismaService;
  const f = await deliveryWorkflowFixture(tx, tenantCode);
  await tx.document.update({
    where: { id: f.document.id },
    data: { status: "AVAILABLE" },
  });
  const qaInput = {
    decision: "APPROVED",
    caseVersion: 1,
    notes: "All required evidence was independently checked.",
    checklist: [...QA_REQUIRED_CHECKLIST],
    reworkCheckIds: [],
  };
  await assert.rejects(
    decideQaCase(db, f.qa, f.row.publicId, qaInput),
    /Evidence is not ready/,
  );
  await tx.document.update({
    where: { id: f.document.id },
    data: { status: "VERIFIED" },
  });
  const qa = await decideQaCase(db, f.qa, f.row.publicId, qaInput);
  assert.equal(qa.caseStatus, "MANAGER_REVIEW");
  assert.equal(await tx.report.count({ where: { caseId: f.row.id } }), 0);
  const manager = new ManagerReviewService(
    db,
    new SubjectPiiService(new SecretBoxService(new ConfigService(process.env))),
  );
  const decision = {
    caseVersion: qa.caseVersion,
    decision: "APPROVED" as const,
    notes: "Manager independently reviewed all findings and sources.",
    recommendation:
      "Verified facts match the approved scope and supplied evidence.",
  };
  await assert.rejects(
    manager.decide(
      { ...f.qa, roles: ["PLATFORM_ADMIN"] },
      f.row.publicId,
      decision,
    ),
    /independent/,
  );
  await tx.auditEvent.create({
    data: {
      tenantId: f.tenant.id,
      actorUserId: f.finance.userId,
      action: "verification.method-responded",
      resourceType: "case",
      resourcePublicId: f.row.publicId,
    },
  });
  await assert.rejects(
    manager.decide(
      { ...f.finance, roles: ["PLATFORM_ADMIN"] },
      f.row.publicId,
      decision,
    ),
    /independent/,
  );
  const approved = await manager.decide(f.manager, f.row.publicId, decision);
  assert.equal(approved.caseStatus, "REPORT_PENDING");
  assert.ok(approved.reportId);
  const approvalSnapshot = await tx.managerReview.findUniqueOrThrow({
    where: { publicId: approved.id },
  });
  const captured = JSON.parse(approvalSnapshot.snapshotJson) as {
    checks: Array<{ methods: Array<{ method: string; result: string }> }>;
  };
  assert.deepEqual(
    captured.checks[0]?.methods.map((method) => [method.method, method.result]),
    [["MANUAL", "CLEAR"]],
  );
  const generation = new ReportGenerationService(
    db,
    storage,
    new ReportPdfService(),
  );
  const reports = new ReportsService(db, storage, generation);
  const prepared = await generation.generateApproved(
    f.tenant.id,
    f.row.publicId,
    approved.reportId,
  );
  assert.equal(prepared.status, "PREPARED");
  assert.equal(objects.size, 1);
  await assert.rejects(
    reports.download(f.clientActor, approved.reportId),
    /unavailable/,
  );
  await assert.rejects(
    reports.release(f.manager, f.row.publicId, approved.reportId),
    /full payment/,
  );
  const invoiceService = new InvoiceIssueService(db, {} as InvoicePdfService);
  const invoiceInput = {
    clientId: f.client.publicId,
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    lines: [
      {
        caseId: f.row.publicId,
        reportId: approved.reportId,
        description: "Synthetic HireCheck",
        quantity: 1,
        unitPrice: 100,
        taxRate: 0,
      },
    ],
  };
  const firstLine = invoiceInput.lines[0];
  assert.ok(firstLine, "The controlled invoice must have a service line");
  await assert.rejects(
    invoiceService.create(f.finance, {
      ...invoiceInput,
      lines: [{ ...firstLine, unitPrice: 1 }],
    }),
    /original case price and tax/,
  );
  const invoice = await invoiceService.create(f.finance, invoiceInput);
  await assert.rejects(
    invoiceService.create(f.finance, invoiceInput),
    /already allocated/,
  );
  const paymentService = new InvoicePaymentService(db);
  const first = await paymentService.record(f.finance, invoice.id, {
    amount: 40,
    method: "BANK_TRANSFER",
    receivedAt: new Date().toISOString(),
    version: 1,
  });
  assert.equal(first.invoiceStatus, "PARTIALLY_PAID");
  await assert.rejects(
    reports.download(f.clientActor, approved.reportId),
    /unavailable/,
  );
  const paid = await paymentService.record(f.finance, invoice.id, {
    amount: 60,
    method: "BANK_TRANSFER",
    receivedAt: new Date().toISOString(),
    version: first.invoiceVersion,
  });
  assert.equal(paid.invoiceStatus, "PAID");
  const released = await tx.report.findUniqueOrThrow({
    where: { publicId: approved.reportId },
  });
  assert.equal(released.status, "PUBLISHED");
  assert.ok(released.releasedAt);
  const finalCase = await tx.verificationCase.findUniqueOrThrow({
    where: { id: f.row.id },
  });
  assert.equal(finalCase.status, "COMPLETED");
  await reports.download(f.clientActor, approved.reportId);
  await assert.rejects(
    reports.download({ ...f.clientActor, clientId: -1n }, approved.reportId),
    /unavailable/,
  );
  assert.equal((await reports.verify(prepared.authenticityCode)).valid, true);
  await verifyCaseActivity(db, tx, storage, f, approved.reportId);
  const reopen = await new CaseReopeningService(db).reopen(
    f.manager,
    f.row.publicId,
    {
      caseVersion: finalCase.version,
      notes: "Synthetic correction requires a fresh independent verification.",
      checkIds: [f.check.publicId],
    },
  );
  assert.equal(reopen.caseStatus, "IN_PROGRESS");
  assert.equal((await reports.verify(prepared.authenticityCode)).valid, false);
  assert.equal(
    await tx.reportVersion.count({ where: { reportId: released.id } }),
    1,
  );
  const restarted = await tx.caseCheck.findUniqueOrThrow({
    where: { id: f.check.id },
  });
  assert.equal(restarted.reviewCycle, 2);
  assert.equal(
    await tx.verificationMethodRun.count({
      where: { checkId: f.check.id, status: "REQUESTED" },
    }),
    1,
  );
  throw sentinel;
}

async function main() {
  try {
    let failure: unknown;
    try {
      await prisma.$transaction(run, {
        timeout: 120_000,
        maxWait: 10_000,
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error !== sentinel) failure = error;
    }
    assert.equal(await prisma.tenant.count({ where: { code: tenantCode } }), 0);
    if (failure)
      throw failure instanceof Error
        ? failure
        : new Error("Workflow integration failed", { cause: failure });
    console.log(
      "PASS: real SQL workflow, evidence/QA/manager/payment gates, tenant scope, reopening; all fixture rows rolled back; PDFs memory-only.",
    );
  } finally {
    objects.clear();
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Workflow test failed",
  );
  process.exitCode = 1;
});
