import type { Prisma } from "../generated/prisma/client";
import type { ApprovedReportSnapshot } from "./report-data";
import type { SubjectPiiService } from "../common/security/subject-pii.service";

export const reportApprovalSelect = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  version: true,
  clientId: true,
  branchId: true,
  tenantId: true,
  completedAt: true,
  riskLevel: true,
  client: { select: { displayName: true } },
  subject: {
    select: {
      fullName: true,
      employeeCode: true,
      dateOfBirth: true,
      piiCiphertext: true,
      piiKeyVersion: true,
    },
  },
  services: { select: { serviceFamily: true, configurationJson: true } },
  checks: {
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      result: true,
      riskLevel: true,
      sourceSummary: true,
      caseService: { select: { serviceFamily: true } },
      methodRuns: {
        where: { status: "RESPONDED" },
        select: {
          method: true,
          result: true,
          provider: true,
          reference: true,
          sourceContact: true,
          summary: true,
          requestedAt: true,
          respondedAt: true,
        },
      },
      findings: {
        select: {
          severity: true,
          title: true,
          description: true,
          source: true,
        },
      },
      tasks: {
        where: { status: "COMPLETED" },
        select: { completedById: true },
      },
    },
  },
  documents: {
    where: { status: "VERIFIED" },
    orderBy: { createdAt: "desc" },
    select: {
      type: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { originalName: true, sha256: true },
      },
    },
  },
  fieldVisits: {
    where: { status: "COMPLETED" },
    select: {
      publicId: true,
      evidenceSince: true,
      evidence: {
        select: { type: true, sha256: true, capturedAt: true, createdAt: true },
      },
    },
  },
  qaReviews: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      publicId: true,
      decision: true,
      reviewerId: true,
      createdAt: true,
      notes: true,
      reviewer: { select: { displayName: true } },
    },
  },
  reports: { select: { id: true, workflowVersion: true, status: true } },
} satisfies Prisma.VerificationCaseSelect;

export type ApprovalCase = Prisma.VerificationCaseGetPayload<{
  select: typeof reportApprovalSelect;
}>;

export function legacyApprovalRequired(
  row: Pick<ApprovalCase, "status" | "reports" | "qaReviews">,
) {
  return (
    row.status === "COMPLETED" &&
    row.qaReviews[0]?.decision === "APPROVED" &&
    row.reports.some(
      (report) =>
        report.workflowVersion === 1 &&
        ["QUEUED", "FAILED"].includes(report.status),
    ) &&
    !row.reports.some(
      (report) => report.status === "PUBLISHED" || report.workflowVersion === 2,
    )
  );
}

export function snapshotForApproval(
  row: ApprovalCase,
  managerName: string,
  recommendation: string,
  approvedAt: Date,
  pii?: Pick<SubjectPiiService, "open">,
): ApprovedReportSnapshot {
  const review = row.qaReviews[0]!;
  const identityDetails: Array<[string, string]> = [];
  if (row.subject.piiCiphertext && !pii)
    throw new Error(
      "Authorized subject decryption is required for the approved report",
    );
  const employeeCode = pii
    ? pii.open(row.subject).employeeCode
    : row.subject.employeeCode;
  if (employeeCode) identityDetails.push(["Employee reference", employeeCode]);
  if (row.subject.dateOfBirth)
    identityDetails.push([
      "Date of birth",
      row.subject.dateOfBirth.toISOString().slice(0, 10),
    ]);
  for (const service of row.services) {
    identityDetails.push(...safeServiceDetails(service.configurationJson));
  }
  const evidence = row.documents.flatMap((document) =>
    document.versions.map((version) => ({
      type: document.type,
      name: version.originalName,
      sha256: version.sha256,
    })),
  );
  for (const visit of row.fieldVisits) {
    for (const item of visit.evidence.filter(
      (entry) => entry.createdAt >= visit.evidenceSince,
    )) {
      evidence.push({
        type: `FIELD_${item.type}`,
        name: `Field visit ${visit.publicId} · ${item.capturedAt.toISOString()}`,
        sha256: item.sha256,
      });
    }
  }
  return {
    caseNumber: row.caseNumber,
    clientName: row.client.displayName,
    candidateName: row.subject.fullName,
    completedAt: approvedAt.toISOString(),
    riskLevel: row.riskLevel,
    services: [
      ...new Set(row.services.map((service) => service.serviceFamily)),
    ],
    identityDetails,
    reviewerName: review.reviewer.displayName,
    reviewedAt: review.createdAt.toISOString(),
    managerName,
    approvedAt: approvedAt.toISOString(),
    recommendation,
    evidence,
    checks: row.checks.map((check) => ({
      type: check.type,
      result: check.result,
      riskLevel: check.riskLevel,
      serviceFamily: check.caseService?.serviceFamily,
      methods: check.methodRuns.map((run) => ({
        ...run,
        requestedAt: run.requestedAt?.toISOString(),
        respondedAt: run.respondedAt?.toISOString() ?? null,
      })),
      sourceSummary: check.sourceSummary,
      findings: check.findings,
    })),
  };
}

function safeServiceDetails(json: string): Array<[string, string]> {
  const labels: Record<string, string> = {
    organisationName: "Organisation name",
    conflictOfInterest: "Declared conflict of interest",
    directorships: "Declared directorships",
    declaration: "Submitted declaration",
    referenceContacts: "Provided reference contacts",
    legalName: "Business legal name",
    companyName: "Company name",
    registrationNumber: "Registration number",
    gstin: "GSTIN",
    cin: "CIN",
    employerName: "Employer",
    institutionName: "Institution",
    declaredConflicts: "Declared conflicts",
    businessInterests: "Business interests",
    vendorCategory: "Vendor category",
  };
  try {
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.entries(data).flatMap(([key, value]) =>
      labels[key] && typeof value === "string" && value.trim()
        ? [[labels[key], value.trim().slice(0, 2000)] as [string, string]]
        : [],
    );
  } catch {
    return [];
  }
}
