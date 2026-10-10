import type { ReportAudience, ReportView } from "../../src/lib/backend-api/report-preview";

/** A small synthetic report (one employment check with proof) for on-screen report mocks. */
export function sampleReportView(
  audience: ReportAudience,
  input: { caseNumber: string; candidateName: string; checkId: string },
): ReportView {
  return {
    caseNumber: input.caseNumber,
    candidateName: input.candidateName,
    clientName: "Test Organisation",
    audience,
    generatedAt: new Date().toISOString(),
    header: { employeeCode: "EMP-1001", joiningDate: "2026-10-01", clientProcess: "ABC-1212" },
    details: [],
    overall: "YELLOW",
    pendingChecks: 0,
    items: [
      {
        checkId: input.checkId,
        label: "Employment",
        detail: "Acme Solutions",
        status: "Minor discrepancy",
        disposition: "YELLOW",
        pending: false,
        annexure: 1,
        annexureTitle: "Detailed Check Report – Employment",
        blocks: [
          { kind: "facts", rows: [["Company name and address", "Acme Solutions, Pune"]] },
          {
            kind: "compare",
            rows: [
              ["Period of employment", "12 Aug 2024 to 02 Dec 2025", "12 Aug 2024 to 15 Oct 2025"],
              ["Designation", "Account Associate", "Account Associate"],
              ["CTC (in INR)", "4,20,000", "Not disclosed"],
            ],
          },
          {
            kind: "facts",
            rows: [
              ["Eligibility for rehire", "Yes"],
              ["Referee contact details / email ID", "HR Associate, hr@acme.example"],
              ["Any other comments", "Supporting proof is attached as Annexure II."],
            ],
          },
        ],
        proofAnnexure: 2,
        proofTitle: "Email response for employment verification",
        proofs: [
          {
            id: "proof-1",
            name: "hr-reply.png",
            contentType: "image/png",
            caption: "Email response from Acme HR",
          },
        ],
      },
    ],
    internal:
      audience === "internal"
        ? [
            {
              checkId: input.checkId,
              type: "EMPLOYMENT",
              team: "Employment team",
              verifiedBy: "Employment Verifier",
              verifiedAt: new Date().toISOString(),
              notes: [],
            },
          ]
        : [],
    documents: [],
  };
}

/** 1×1 PNG for proof thumbnails. */
export const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
