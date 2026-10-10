import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import type { Actor } from "../src/common/auth/actor";
import { SAPLING_WORDMARK_PNG } from "../src/common/pdf/brand-logo";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { maskId, reportItems } from "../src/reports/report-annexures";
import type { ReportData } from "../src/reports/report-data";
import { ReportPdfService } from "../src/reports/report-pdf.service";
import { ReportPreviewService } from "../src/reports/report-preview.service";

const base: ReportData = {
  caseNumber: "SG-ANNEX",
  generatedAt: new Date("2026-10-10T06:00:00Z"),
  authenticityCode: "SG-TEST",
  clientName: "Client",
  candidateName: "Candidate",
  completedAt: null,
  riskLevel: null,
  header: {
    employeeCode: "E-1",
    joiningDate: "2026-10-01",
    clientProcess: "P-1",
  },
  checks: [],
};

void test("address entries become one summary row and annexure each, current address first", () => {
  const items = reportItems({
    ...base,
    checks: [
      {
        type: "ADDRESS",
        id: "c-1",
        result: "CLEAR",
        disposition: "GREEN",
        riskLevel: null,
        sourceSummary: "Resides at the address",
        findings: [],
        claimed: [
          {
            addressType: "Permanent",
            address: "12 Lake Road",
            city: "Mysuru",
            pincode: "570001",
          },
          {
            addressType: "Current",
            address: "4B Palm",
            city: "Bengaluru",
            pincode: "560034",
          },
        ],
        verified: [
          { addressConfirmed: "Yes", method: "Physical visit" },
          {
            addressConfirmed: "Yes",
            residencyProof: "Aadhaar",
            residencyProofNumber: "123412344821",
            method: "Digital address link",
          },
        ],
        proofs: [
          {
            id: "p-1",
            name: "photo.png",
            contentType: "image/png",
            caption: "Location",
            sha256: "a".repeat(64),
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    items.map((item) => item.label),
    ["Current Address Verification", "Permanent Address Verification"],
  );
  // Annexure I and II for the entries, III for the check's proof.
  assert.deepEqual(
    items.map((item) => item.annexure),
    [1, 2],
  );
  assert.equal(items[1]!.proofAnnexure, 3);
  assert.equal(items[0]!.proofs.length, 0);
  const text = JSON.stringify(items[0]!.blocks);
  assert.match(text, /XXXX-XXXX-4821/);
  assert.doesNotMatch(text, /123412344821/);
  assert.match(text, /Supporting proof is attached as Annexure III\./);
});

void test("database check lists the Indian databases and one summary line for global lists; costs never reach the annexure", () => {
  const [database, employment] = reportItems({
    ...base,
    checks: [
      {
        type: "EMPLOYMENT",
        result: "DISCREPANCY",
        disposition: "YELLOW",
        riskLevel: null,
        sourceSummary: null,
        findings: [],
        claimed: [
          {
            employerName: "Acme",
            tenureFrom: "2024-01-01",
            tenureTo: "2025-01-01",
          },
        ],
        verified: [
          {
            employerName: "Acme",
            tenureFrom: "2024-01-01",
            tenureTo: "2024-11-01",
            extraCost: "500",
            extraCostApproval: "mail-1",
            method: "Email",
          },
        ],
      },
      {
        type: "GLOBAL_DATABASE",
        result: "CLEAR",
        disposition: "GREEN",
        riskLevel: null,
        sourceSummary: null,
        findings: [],
        verified: [
          {
            indiaDatabases: "No record found",
            globalSanctions: "No record found",
          },
        ],
      },
    ],
  }).sort((a) => (a.label.startsWith("India") ? -1 : 1));
  const lists = JSON.stringify(database!.blocks);
  assert.match(lists, /Reserve Bank of India's Loan Defaulters List/);
  assert.match(lists, /OFAC \(USA\), United Nations/);
  assert.match(lists, /lists searched/);
  // Country-by-country lists are not printed (no Germany, Canada… rows).
  assert.doesNotMatch(lists, /Bundesbank|Canadian Criminal Code/);
  assert.match(lists, /No Record Found/);
  assert.equal(employment!.status, "Minor discrepancy");
  const detail = JSON.stringify(employment!.blocks);
  assert.match(detail, /01 Jan 2024 to 01 Nov 2024/);
  assert.doesNotMatch(detail, /mail-1|"500"/);
});

void test("a check still being verified is listed as in progress without details", () => {
  const [item] = reportItems({
    ...base,
    interim: true,
    checks: [
      {
        type: "EDUCATION",
        result: null,
        riskLevel: null,
        sourceSummary: null,
        findings: [],
      },
    ],
  });
  assert.equal(item!.status, "In progress");
  assert.equal(item!.disposition, null);
  assert.equal(item!.blocks[0]!.kind, "note");
});

void test("Aadhaar numbers are masked; other IDs are printed as given", () => {
  assert.equal(maskId("1234 5678 9012"), "XXXX-XXXX-9012");
  assert.equal(maskId("ABCDE1234F", "PAN"), "ABCDE1234F");
});

void test("proof screenshots are embedded as figures; an unreadable proof is listed instead of failing", async () => {
  const proofs = [
    {
      id: "ok",
      name: "portal.png",
      contentType: "image/png",
      caption: "UIDAI portal",
      sha256: "b".repeat(64),
    },
    {
      id: "bad",
      name: "broken.pdf",
      contentType: "application/pdf",
      caption: null,
      sha256: "c".repeat(64),
    },
  ];
  const data: ReportData = {
    ...base,
    checks: [
      {
        type: "IDENTITY",
        result: "CLEAR",
        disposition: "GREEN",
        riskLevel: null,
        sourceSummary: "Verified",
        findings: [],
        verified: [
          { idType: "Aadhaar", idNumber: "123412341234", nameMatch: "Yes" },
        ],
        proofs,
      },
    ],
  };
  const without = await PDFDocument.load(
    await new ReportPdfService().render(data),
  );
  const pdf = await new ReportPdfService().render(data, {
    proofs: new Map([
      ["ok", Buffer.from(SAPLING_WORDMARK_PNG, "base64")],
      ["bad", Buffer.from("not a pdf")],
    ]),
  });
  const document = await PDFDocument.load(pdf);
  assert.ok(document.getPageCount() >= 3);
  assert.ok(pdf.length > (await without.save()).length);
});

const caseRow = {
  id: 1n,
  caseNumber: "SG-PREVIEW",
  status: "QA_REVIEW",
  externalRef: "P-9",
  joiningDate: new Date("2026-10-01T00:00:00Z"),
  riskLevel: null,
  client: { displayName: "Client" },
  subject: {
    fullName: "Candidate",
    employeeCode: "E-9",
    dateOfBirth: null,
    piiCiphertext: null,
    piiKeyVersion: null,
  },
  services: [],
  documents: [],
  fieldVisits: [],
  qaReviews: [],
  reports: [],
  checks: [
    {
      publicId: "check-a",
      type: "EMPLOYMENT",
      status: "COMPLETED",
      result: "CLEAR",
      disposition: "GREEN",
      riskLevel: null,
      sourceSummary: "Confirmed",
      initiationJson: null,
      verifiedJson: JSON.stringify({
        entries: [{ employerName: "Acme", extraCost: "700" }],
      }),
      verifiedAt: new Date(),
      verifiedById: 21n,
      department: { name: "Employment team" },
      caseService: null,
      evidence: [],
      methodRuns: [],
      findings: [],
      tasks: [{ completedById: 21n }],
    },
    {
      publicId: "check-b",
      type: "EDUCATION",
      status: "COMPLETED",
      result: "CLEAR",
      disposition: "GREEN",
      riskLevel: null,
      sourceSummary: "Confirmed",
      initiationJson: null,
      verifiedJson: null,
      verifiedAt: null,
      verifiedById: null,
      department: { name: "Education team" },
      caseService: null,
      evidence: [],
      methodRuns: [],
      findings: [],
      tasks: [],
    },
  ],
};

function previewFixture() {
  const audits: Array<{ action: string; afterJson: string }> = [];
  const rendered: ReportData[] = [];
  const prisma = {
    verificationCase: { findFirst: () => caseRow },
    caseCheck: { findMany: () => [{ publicId: "check-a" }] },
    user: { findMany: () => [{ id: 21n, displayName: "Employment Verifier" }] },
    checkEvidence: { findMany: () => [] },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  } as unknown as PrismaService;
  const pdf = {
    render: (data: ReportData) => {
      rendered.push(data);
      return Promise.resolve(Buffer.from("%PDF-"));
    },
  } as unknown as ReportPdfService;
  const service = new ReportPreviewService(
    prisma,
    {} as LocalObjectStorageService,
    pdf,
    {
      open: (subject: { employeeCode: string | null }) => ({
        employeeCode: subject.employeeCode,
      }),
    } as unknown as SubjectPiiService,
  );
  return { service, audits, rendered };
}

const qa = {
  tenantId: 1n,
  userId: 40n,
  roles: ["QA_REVIEWER"],
} as unknown as Actor;
const rm = {
  tenantId: 1n,
  userId: 50n,
  roles: ["SPOC_RM"],
  spocClients: [{ id: 3n }],
} as unknown as Actor;
const lead = {
  tenantId: 1n,
  userId: 30n,
  roles: ["VERIFIER"],
  departments: [{ id: 4n, role: "LEAD", kind: "VERIFICATION" }],
} as unknown as Actor;
const finance = {
  tenantId: 1n,
  userId: 60n,
  roles: ["FINANCE_MANAGER"],
} as unknown as Actor;

void test("the on-screen report gives QA the same rows and annexures as the PDF, with proof references", async () => {
  const { service, audits } = previewFixture();
  const view = await service.view(qa, "case-1", "internal");
  assert.deepEqual(
    view.items.map((item) => [item.label, item.checkId, item.annexure]),
    [
      ["Education", "check-b", 1],
      ["Employment", "check-a", 2],
    ],
  );
  assert.equal(view.overall, "GREEN");
  assert.equal(
    view.internal.find((check) => check.checkId === "check-a")?.verifiedBy,
    "Employment Verifier",
  );
  assert.match(audits[0]!.afterJson, /"format":"screen"/);
  const client = await service.view(rm, "case-1", "client");
  assert.deepEqual(client.internal, []);
});

void test("QA opens the internal copy with who verified each check and the costs; the view is audited", async () => {
  const { service, audits, rendered } = previewFixture();
  await service.render(qa, "case-1", "internal");
  const data = rendered[0]!;
  assert.equal(data.draft, true);
  assert.equal(data.checks.length, 2);
  assert.equal(data.checks[0]!.internal?.verifiedBy, "Employment Verifier");
  assert.deepEqual(data.checks[0]!.internal?.notes, [
    ["Extra cost (₹)", "700"],
  ]);
  assert.equal(data.header?.clientProcess, "P-9");
  assert.equal(audits[0]!.action, "report.preview-viewed");
  assert.match(audits[0]!.afterJson, /"audience":"internal"/);
});

void test("the RM opens only the client copy, without costs; a Team Leader sees only its team's checks", async () => {
  const { service, rendered } = previewFixture();
  await assert.rejects(
    service.render(rm, "case-1", "internal"),
    ForbiddenException,
  );
  await service.render(rm, "case-1", "client");
  assert.equal(rendered[0]!.audience, "client");
  assert.doesNotMatch(JSON.stringify(rendered[0]!.checks), /extraCost|"700"/);
  await service.render(lead, "case-1", "internal");
  assert.deepEqual(
    rendered[1]!.checks.map((check) => check.id),
    ["check-a"],
  );
  await assert.rejects(
    service.render(finance, "case-1", "client"),
    ForbiddenException,
  );
});

void test("report header details: the case RM edits them before approval and the change is audited", async () => {
  const audits: Array<{
    action: string;
    beforeJson?: string;
    afterJson: string;
  }> = [];
  const updates: Array<Record<string, unknown>> = [];
  let row = {
    id: 1n,
    status: "MANAGER_REVIEW",
    externalRef: null as string | null,
    joiningDate: null as Date | null,
    assignedOpsUserId: 50n,
    dataEntryUserId: 70n,
  };
  const tx = {
    verificationCase: {
      update: (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        row = { ...row, ...args.data };
      },
    },
    auditEvent: {
      create: (args: { data: (typeof audits)[number] }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    verificationCase: { findFirst: () => row },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const service = new ReportPreviewService(
    prisma,
    {} as LocalObjectStorageService,
    {} as ReportPdfService,
    {} as SubjectPiiService,
  );
  const saved = await service.updateDetails(rm, "case-1", {
    joiningDate: "2026-11-02",
    clientProcess: " ABC-1212 ",
  });
  assert.deepEqual(saved, {
    joiningDate: "2026-11-02",
    clientProcess: "ABC-1212",
    canEdit: true,
  });
  assert.equal(audits[0]!.action, "case.report-details-updated");
  assert.match(audits[0]!.afterJson, /ABC-1212/);
  assert.equal("version" in updates[0]!, false);
  await assert.rejects(
    service.updateDetails({ ...rm, userId: 51n }, "case-1", {
      clientProcess: "X",
    }),
    ForbiddenException,
  );
  row = { ...row, status: "COMPLETED" };
  assert.equal((await service.details(rm, "case-1")).canEdit, false);
  prisma.verificationCase.findFirst = (() => null) as never;
  await assert.rejects(service.details(rm, "case-1"), NotFoundException);
});
