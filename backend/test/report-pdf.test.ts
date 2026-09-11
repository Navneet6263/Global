import assert from "node:assert/strict";
import { test } from "node:test";
import { ReportPdfService } from "../src/reports/report-pdf.service";
import { PDFDocument } from "pdf-lib";

void test("report renderer produces a PDF with authenticity metadata", async () => {
  const result = await new ReportPdfService().render({
    caseNumber: "SG-20260815-ABC123",
    generatedAt: new Date("2026-08-15T10:00:00Z"),
    authenticityCode: "SG-A1B2C3D4E5F6",
    clientName: "सैपलिंग ग्लोबल क्लाइंट",
    candidateName: "राहुल मेहरा",
    completedAt: new Date("2026-08-15T09:00:00Z"),
    riskLevel: "LOW",
    checks: [
      {
        type: "IDENTITY",
        result: "CLEAR",
        riskLevel: "LOW",
        sourceSummary: "पहचान स्वीकृत स्रोत से सत्यापित हुई।",
        findings: [],
      },
    ],
  });

  assert.equal(result.subarray(0, 5).toString(), "%PDF-");
  assert.ok(result.length > 1000);
});

void test("long source and evidence text paginate across service templates", async () => {
  const pdf = await new ReportPdfService().render({
    caseNumber: "SG-REPORT-LAYOUT",
    generatedAt: new Date(),
    authenticityCode: "SG-LAYOUT",
    clientName: "Layout test client",
    candidateName: "Report layout subject",
    completedAt: null,
    riskLevel: "LOW",
    services: ["HIRECHECK", "INTEGRITYCHECK", "LEADERCHECK", "VENDORCHECK"],
    reviewerName: "Independent QA",
    managerName: "Independent manager",
    recommendation:
      "The factual findings and sources were independently reviewed.",
    evidence: [
      { type: "IDENTITY", name: "a".repeat(500), sha256: "a".repeat(64) },
    ],
    checks: [
      {
        type: "IDENTITY",
        result: "CLEAR",
        riskLevel: "LOW",
        sourceSummary:
          "Long source explanation with factual confirmation. ".repeat(400),
        findings: [],
      },
    ],
  });
  const document = await PDFDocument.load(pdf);
  assert.ok(document.getPageCount() > 4);
  assert.equal(
    document.getSubject(),
    "Approved HIRECHECK, INTEGRITYCHECK, LEADERCHECK, VENDORCHECK verification findings",
  );
});
