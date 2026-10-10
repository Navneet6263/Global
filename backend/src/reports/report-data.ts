/** A proof file the verifier attached to a check (screenshot, written reply, lab report). */
export interface ReportProof {
  id: string;
  name: string;
  contentType: string;
  caption: string | null;
  sha256: string;
}

/** Internal-only detail of a check, printed in the internal working copy only. */
export interface ReportCheckInternal {
  team?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  notes?: Array<[string, string]>;
}

export interface ReportData {
  caseNumber: string;
  /** Executive-summary header fields (Sample Report). */
  header?: {
    employeeCode?: string | null;
    /** YYYY-MM-DD */
    joiningDate?: string | null;
    /** Client process / reference code shown next to the client name. */
    clientProcess?: string | null;
  };
  /** "client" (default) is what the client receives; "internal" adds the working log. */
  audience?: "client" | "internal";
  /** A preview before final approval: watermarked, status "Draft". */
  draft?: boolean;
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
    /** Check public id; ties proof files to the check. */
    id?: string;
    serviceFamily?: string;
    /** Proof files in upload order; bytes are passed to the renderer separately. */
    proofs?: ReportProof[];
    internal?: ReportCheckInternal;
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

/** Proof file bytes keyed by proof id, loaded from storage when the PDF is rendered. */
export interface ReportAssets {
  proofs?: ReadonlyMap<string, Uint8Array>;
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
