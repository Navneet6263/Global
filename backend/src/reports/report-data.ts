export interface ReportData {
  caseNumber: string;
  generatedAt: Date;
  authenticityCode: string;
  clientName: string;
  candidateName: string;
  completedAt: Date | null;
  riskLevel: string | null;
  /** Interim (work in progress) report: pending checks shown as in progress. */
  interim?: boolean;
  services?: string[];
  identityDetails?: Array<[string, string]>;
  reviewerName?: string;
  reviewedAt?: string;
  managerName?: string;
  approvedAt?: string;
  recommendation?: string;
  evidence?: Array<{ type: string; name: string; sha256: string }>;
  checks: Array<{
    type: string;
    serviceFamily?: string;
    methods?: Array<{
      method: string;
      result: string | null;
      provider: string | null;
      reference: string | null;
      sourceContact?: string | null;
      summary?: string | null;
      requestedAt?: string;
      respondedAt?: string | null;
    }>;
    result: string | null;
    /** Colour code; absent in snapshots approved before colour codes existed. */
    disposition?: string | null;
    /** LHS: what Data Entry recorded at initiation (one record per entry). */
    claimed?: Array<Record<string, string>>;
    /** RHS: what the source confirmed (one record per entry). */
    verified?: Array<Record<string, string>>;
    riskLevel: string | null;
    sourceSummary: string | null;
    findings: Array<{
      severity: string;
      title: string;
      description: string;
      source?: string | null;
    }>;
  }>;
}

export type ApprovedReportSnapshot = Omit<
  ReportData,
  "generatedAt" | "authenticityCode" | "completedAt"
> & {
  completedAt: string | null;
};

export const serviceReportSections: Record<
  string,
  { title: string; focus: string }
> = {
  HIRECHECK: {
    title: "HireCheck — employment verification",
    focus:
      "Identity, employment, education, address and approved background checks.",
  },
  INTEGRITYCHECK: {
    title: "IntegrityCheck — integrity review",
    focus:
      "Declared conflicts, factual misconduct findings and reviewed integrity sources.",
  },
  LEADERCHECK: {
    title: "LeaderCheck — leadership due diligence",
    focus:
      "Business interests, directorship, public records and human-reviewed leadership findings.",
  },
  VENDORCHECK: {
    title: "VendorCheck — vendor due diligence",
    focus:
      "Business registration, tax identity, directors, source confirmations and vendor risk.",
  },
};
