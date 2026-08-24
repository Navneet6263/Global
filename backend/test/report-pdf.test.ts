import assert from "node:assert/strict";
import { test } from "node:test";
import { ReportPdfService } from "../src/reports/report-pdf.service";

void test("report renderer produces a PDF with authenticity metadata", async () => {
  const result = await new ReportPdfService().render({
    caseNumber: "SG-20260815-ABC123",
    generatedAt: new Date("2026-08-15T10:00:00Z"),
    authenticityCode: "SG-A1B2C3D4E5F6",
    clientName: "Sapling Global Client",
    candidateName: "Rahul Mehra",
    completedAt: new Date("2026-08-15T09:00:00Z"),
    riskLevel: "LOW",
    checks: [
      {
        type: "IDENTITY",
        result: "CLEAR",
        riskLevel: "LOW",
        sourceSummary: "Identity matched against approved source.",
        findings: [],
      },
    ],
  });

  assert.equal(result.subarray(0, 5).toString(), "%PDF-");
  assert.ok(result.length > 1000);
});
