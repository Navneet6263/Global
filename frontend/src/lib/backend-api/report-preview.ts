import { apiDownload, apiRequest } from "./client";

export type ReportAudience = "client" | "internal";

export type ReportColour = "GREEN" | "YELLOW" | "RED" | "AMBER" | "BLUE" | "CLIENT_REVIEW";

/** Building blocks of an annexure (mirrors backend report-annexures.ts). */
export type AnnexureBlock =
  | { kind: "facts"; title?: string; rows: Array<[string, string]> }
  | { kind: "compare"; title?: string; rows: Array<[string, string, string]> }
  | { kind: "numbered"; head?: [string, string]; rows: Array<[string, string]> }
  | {
      kind: "results";
      title?: string;
      head: [string, string, string?];
      note?: string;
      groups: Array<{
        heading?: string;
        rows: Array<{
          name: string;
          detail?: string;
          result: string;
          colour?: ReportColour | null;
        }>;
      }>;
    }
  | { kind: "note"; title?: string; text: string };

export interface ReportViewItem {
  checkId: string | null;
  label: string;
  detail: string;
  status: string;
  disposition: ReportColour | null;
  pending: boolean;
  annexure: number;
  annexureTitle: string;
  blocks: AnnexureBlock[];
  proofAnnexure: number | null;
  proofTitle: string;
  proofs: Array<{ id: string; name: string; contentType: string; caption: string | null }>;
}

/** The report as structured data, built by the same code as the PDF. */
export interface ReportView {
  caseNumber: string;
  candidateName: string;
  clientName: string;
  audience: ReportAudience;
  generatedAt: string;
  header: {
    employeeCode?: string | null;
    joiningDate?: string | null;
    clientProcess?: string | null;
  };
  details: Array<[string, string]>;
  overall: ReportColour | null;
  pendingChecks: number;
  items: ReportViewItem[];
  internal: Array<{
    checkId: string | null;
    type: string;
    team?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
    notes?: Array<[string, string]>;
  }>;
  documents: Array<{ type: string; name: string }>;
}

export interface ReportDetails {
  /** YYYY-MM-DD */
  joiningDate: string | null;
  clientProcess: string | null;
  canEdit: boolean;
}

const base = (caseId: string) => `/cases/${encodeURIComponent(caseId)}`;

/** Live draft of the case report and the header details it prints. */
export const reportPreviewApi = {
  pdf: (caseId: string, audience: ReportAudience) =>
    apiDownload(`${base(caseId)}/report-preview?audience=${audience}`),
  view: (caseId: string, audience: ReportAudience) =>
    apiRequest<ReportView>(`${base(caseId)}/report-view?audience=${audience}`),
  details: (caseId: string) => apiRequest<ReportDetails>(`${base(caseId)}/report-details`),
  saveDetails: (
    caseId: string,
    input: { joiningDate?: string | null; clientProcess?: string | null },
  ) =>
    apiRequest<ReportDetails>(`${base(caseId)}/report-details`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};
