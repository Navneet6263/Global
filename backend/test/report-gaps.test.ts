import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import type { Actor } from "../src/common/auth/actor";
import { renderEmail } from "../src/common/mail/email-templates";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { InterimReportService } from "../src/reports/interim-report.service";
import type { ReportData } from "../src/reports/report-data";
import { ReportPdfService, istDate } from "../src/reports/report-pdf.service";
import { queueReportReleasedEmails } from "../src/reports/report-release-email";

void test("report dates print in IST and plain dates stay dates", () => {
  assert.equal(
    istDate(new Date("2026-10-07T11:00:00Z"))
      .replace(/\s+/g, " ")
      .toLowerCase(),
    "07 oct 2026, 04:30 pm ist",
  );
  assert.equal(istDate("2026-10-05"), "05 Oct 2026");
  assert.equal(istDate(null), "Not recorded");
});

void test("interim PDF is marked interim in its metadata", async () => {
  const pdf = await new ReportPdfService().render({
    interim: true,
    caseNumber: "SG-1",
    generatedAt: new Date(),
    authenticityCode: "INTERIM-1",
    clientName: "Client",
    candidateName: "Candidate",
    completedAt: null,
    riskLevel: null,
    checks: [
      {
        type: "EMPLOYMENT",
        result: "CLEAR",
        riskLevel: null,
        sourceSummary: "Confirmed",
        findings: [],
        claimed: [{ employerName: "Acme" }],
        verified: [{ employerName: "Acme", method: "Email" }],
      },
      {
        type: "EDUCATION",
        result: null,
        riskLevel: null,
        sourceSummary: null,
        findings: [],
      },
    ],
  });
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getTitle(), "Sapling Global interim report SG-1");
  assert.match(document.getSubject() ?? "", /^Interim /);
});

void test("report release email names candidate, Sapling ID and employee code", async () => {
  const sealed: unknown[] = [];
  const outbox: unknown[] = [];
  const tx = {
    verificationCase: {
      findUnique: () => ({
        caseNumber: "SG-42",
        subject: {
          fullName: "Aarav Sharma",
          employeeCode: null,
          piiCiphertext: "x",
          piiKeyVersion: 1,
        },
      }),
    },
    user: {
      findMany: () => [
        { email: "admin@client.test" },
        { email: "hr@client.test" },
      ],
    },
    outboxEvent: { create: (args: unknown) => outbox.push(args) },
  } as unknown as Prisma.TransactionClient;
  const sent = await queueReportReleasedEmails(
    tx,
    {
      secretBox: {
        seal: (value: unknown) => (sealed.push(value), "sealed"),
      } as unknown as SecretBoxService,
      pii: {
        open: () => ({ employeeCode: "VI-1042" }),
      } as unknown as SubjectPiiService,
      webOrigin: "https://portal.test",
    },
    { tenantId: 1n, caseId: 5n, reportPublicId: "r-1", recipientIds: [7n, 8n] },
  );
  assert.equal(sent, 2);
  assert.equal(outbox.length, 2);
  const first = sealed[0] as {
    to: string;
    template: string;
    variables: Record<string, string>;
  };
  assert.equal(first.to, "admin@client.test");
  assert.equal(first.template, "report-released");
  const email = renderEmail("report-released", first.variables);
  assert.equal(
    email.subject,
    "Report Submitted for Aarav Sharma, SG-42, VI-1042",
  );
  assert.match(email.html, /portal\.test\/client-portal\/reports/);
});

void test("no recipients means no release email", async () => {
  const tx = {} as Prisma.TransactionClient;
  assert.equal(
    await queueReportReleasedEmails(tx, {} as never, {
      tenantId: 1n,
      caseId: 1n,
      reportPublicId: "r",
      recipientIds: [],
    }),
    0,
  );
});

const actor = {
  tenantId: 1n,
  userId: 3n,
  roles: ["CLIENT_ADMIN"],
  clientId: 4n,
} as Actor;

function interimFixture(status: string) {
  const rendered: ReportData[] = [];
  const audits: unknown[] = [];
  const prisma = {
    verificationCase: {
      findFirst: (args: { where: Record<string, unknown> }) => {
        assert.equal(args.where.clientId, 4n, "client scope applied");
        return {
          id: 1n,
          caseNumber: "SG-9",
          status,
          client: { displayName: "Vision India" },
          services: [{ serviceFamily: "HIRECHECK" }],
          subject: {
            fullName: "Aarav",
            employeeCode: "E-1",
            piiCiphertext: null,
          },
          checks: [
            {
              type: "EMPLOYMENT",
              status: "COMPLETED",
              result: "CLEAR",
              disposition: "GREEN",
              sourceSummary: "HR confirmed",
              initiationJson: JSON.stringify({
                entries: [{ employerName: "Acme" }],
              }),
              verifiedJson: JSON.stringify({
                entries: [
                  {
                    employerName: "Acme",
                    verifierContact: "hr@acme.test",
                    extraCost: "500",
                  },
                ],
              }),
              caseService: { serviceFamily: "HIRECHECK" },
            },
            {
              type: "EDUCATION",
              status: "IN_PROGRESS",
              result: "CLEAR",
              disposition: "GREEN",
              sourceSummary: "draft note",
              initiationJson: null,
              verifiedJson: JSON.stringify({ entries: [{ institute: "IIT" }] }),
              caseService: null,
            },
          ],
        };
      },
    },
    auditEvent: { create: (args: unknown) => audits.push(args) },
  } as unknown as PrismaService;
  const pdf = {
    render: (data: ReportData) => (
      rendered.push(data),
      Promise.resolve(Buffer.from("%PDF-"))
    ),
  } as unknown as ReportPdfService;
  return { service: new InterimReportService(prisma, pdf), rendered, audits };
}

void test("interim report shows finished checks only and strips source contacts and costs", async () => {
  const { service, rendered, audits } = interimFixture("IN_PROGRESS");
  await service.download(actor, "case-id");
  const data = rendered[0]!;
  assert.equal(data.interim, true);
  assert.deepEqual(data.identityDetails, [["Employee code", "E-1"]]);
  const [employment, education] = data.checks;
  assert.deepEqual(employment!.verified, [{ employerName: "Acme" }]);
  assert.equal(education!.result, null, "unfinished check has no result");
  assert.equal(education!.sourceSummary, null);
  assert.deepEqual(education!.verified, []);
  assert.equal(audits.length, 1);
  assert.equal(
    (audits[0] as { data: { action: string } }).data.action,
    "report.interim-downloaded",
  );
});

void test("interim report is refused once the case is completed", async () => {
  const { service, audits } = interimFixture("COMPLETED");
  await assert.rejects(
    service.download(actor, "case-id"),
    /only available while verification is in progress/,
  );
  assert.equal(audits.length, 0);
});
