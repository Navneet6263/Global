export type L2ActorRole = "VERIFIER" | "OPS_MANAGER" | "DATA_ENTRY";

export const ACTOR_PROFILES: Record<
  L2ActorRole,
  { id: string; displayName: string; email: string; roles: string[] }
> = {
  VERIFIER: {
    id: "v-neeraj",
    displayName: "Neeraj Gupta",
    email: "neeraj@example.invalid",
    roles: ["VERIFIER"],
  },
  OPS_MANAGER: {
    id: "ops-ananya",
    displayName: "Ananya Rao",
    email: "ops@example.invalid",
    roles: ["OPS_MANAGER"],
  },
  DATA_ENTRY: {
    id: "de-sara",
    displayName: "Sara Khan",
    email: "sara@example.invalid",
    roles: ["DATA_ENTRY"],
  },
};

export const L2_COLOUR_MATRIX = {
  matrix: {
    EMPLOYMENT: [
      { id: "emp-1", text: "All details verified", colour: "GREEN" },
      { id: "emp-5", text: "Period of employment differs by more than 1 month", colour: "YELLOW" },
      { id: "emp-21", text: "No response / company does not verify as policy", colour: "AMBER" },
    ],
  },
  colourNames: { GREEN: "Green", YELLOW: "Yellow", AMBER: "Orange", RED: "Red" },
  resultFor: {
    GREEN: "CLEAR",
    YELLOW: "DISCREPANCY",
    RED: "DISCREPANCY",
    AMBER: "UNABLE_TO_VERIFY",
  },
};

export const EMP_INIT_FORM = {
  repeatable: true,
  fields: [
    { key: "employerName", label: "Employer name", required: true },
    { key: "empCode", label: "Employee code", required: true },
  ],
};

export const EMP_RHS_FORM = {
  repeatable: true,
  fields: [
    {
      key: "employerName",
      label: "Employer name (confirmed)",
      required: true,
      group: "Employment",
    },
    { key: "verifierName", label: "Verified by (name)", required: true, group: "Referee" },
    {
      key: "method",
      label: "Method of verification",
      required: true,
      kind: "select",
      options: ["Email", "Verbal"],
      group: "Method",
    },
    { key: "verificationDate", label: "Verification date", required: true, kind: "date" },
  ],
};

export interface SimVersion {
  version: number;
  originalName: string;
  contentType: string;
  sizeBytes: string;
  malwareState: string;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  clarificationId: string | null;
  isSubmitted: boolean;
}

export function buildSubmittedDoc(
  versions: SimVersion[],
  currentVersion: number,
  clar: Record<string, unknown> | null,
) {
  return {
    id: "doc-l2-1",
    type: (clar?.requestedDocumentType as string) || "EMPLOYMENT_PROOF",
    status: versions.at(-1)?.reviewStatus === "REJECTED" ? "REUPLOAD_REQUIRED" : "VERIFIED",
    currentVersion,
    versions: versions.map((v) => ({
      ...v,
      isSubmitted: v.version === clar?.submittedDocumentVersion,
    })),
  };
}

export function buildPortalPayload(params: {
  expiresAt: string;
  caseStatus: string;
  depCheckStatus: string;
  currentVersion: number;
  clar: Record<string, unknown> | null;
  rawClar: Record<string, unknown> | null;
}) {
  const { expiresAt, caseStatus, depCheckStatus, currentVersion, clar, rawClar } = params;
  const portalClar = clar
    ? {
        ...clar,
        messages: (
          rawClar!.messages as Array<{ senderType: string; body: string; createdAt: string }>
        ).map((m) => ({ sender: m.senderType, body: m.body, createdAt: m.createdAt })),
      }
    : null;
  return {
    id: "acc-l2-1",
    expiresAt,
    completedAt: null,
    privacyNotice: {
      version: "1",
      title: "Background verification privacy notice",
      paragraphs: ["Privacy notice."],
    },
    case: {
      caseNumber: "SG-2026-L201",
      status: caseStatus,
      candidateName: "Asha Verma",
      clientName: "Horizon Tech",
      checks: [
        { type: "EMPLOYMENT", status: "IN_PROGRESS" },
        { type: "ADDRESS", status: depCheckStatus },
      ],
      documents: [{ type: "EMPLOYMENT_PROOF", status: "VERIFIED", currentVersion }],
      requiredDocumentTypes: ["EMPLOYMENT_PROOF"],
      uploadItems: [
        {
          type: "EMPLOYMENT_PROOF",
          required: true,
          state: "VERIFIED",
          reviewNote: null,
          version: currentVersion,
        },
      ],
      readyToComplete: true,
      clarifications: portalClar ? [portalClar] : [],
      consentStatus: "ACCEPTED",
      reportAvailable: false,
      supportRequests: [],
    },
  };
}

export function buildReentryItem(params: {
  clar: Record<string, unknown> | null;
  caseStatus: string;
  depCheckStatus: string;
  lhsEntries: Array<Record<string, string>>;
  initiatedAt: string;
}) {
  return {
    ...params.clar,
    case: {
      id: "case-l2-1",
      caseNumber: "SG-2026-L201",
      status: params.caseStatus,
      workflowVersion: 3,
      intakeStage: "ROUTED",
      subjectName: "Asha Verma",
      clientName: "Horizon Tech",
    },
    check: {
      id: "chk-emp-l2",
      type: "EMPLOYMENT",
      status: "IN_PROGRESS",
      initiatedAt: params.initiatedAt,
      entries: params.lhsEntries,
      form: EMP_INIT_FORM,
    },
    dependentChecks: {
      count: 1,
      items: [
        {
          checkId: "chk-addr",
          checkType: "ADDRESS",
          status: params.depCheckStatus,
          willReopen: true,
        },
      ],
    },
  };
}

export const L2_TASK_INSIGHTS = {
  summary: {
    active: 1,
    open: 1,
    inProgress: 0,
    blocked: 0,
    overdue: 0,
    dueToday: 0,
    dueNext24h: 1,
    completedToday: 0,
    completedThisWeek: 1,
    totalCompleted: 5,
    averageTurnaroundMinutes: 90,
    slaSampleSize: 1,
    slaHitRate: 100,
  },
  outcomes: { clear: 1, discrepancy: 0, unableToVerify: 0 },
  daily: [],
};

export function buildCheckEvidence(uploadedAt: string) {
  return {
    checkId: "chk-emp-l2",
    canEdit: true,
    maxFiles: 15,
    maxBytes: 8388608,
    items: [
      {
        id: "ev-1",
        name: "hr-confirmation.png",
        contentType: "image/png",
        sizeBytes: 1024,
        caption: "HR verification email",
        uploadedAt,
        uploadedBy: "Neeraj Gupta",
      },
    ],
  };
}

export function buildInitialClarification(params: {
  body: Record<string, unknown> | null;
  dueAt: string;
  nowIso: string;
}) {
  return {
    id: "clar-l2-1",
    level: "L2",
    status: "OPEN",
    subject: params.body?.subject,
    requestedDocumentType: params.body?.requestedDocumentType ?? "EMPLOYMENT_PROOF",
    checkId: "chk-emp-l2",
    checkType: "EMPLOYMENT",
    checkStatus: "IN_PROGRESS",
    submittedDocumentVersion: null,
    opsReviewedAt: null,
    opsReviewNote: null,
    opsReviewedBy: null,
    dataEntryReviewedAt: null,
    dataEntryReviewNote: null,
    dataEntryReviewedBy: null,
    reentryCompletedAt: null,
    rejectionCount: 0,
    lastRejectedAt: null,
    lastRejectedReason: null,
    dueAt: params.dueAt,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
    raisedBy: { id: "v-neeraj", displayName: "Neeraj Gupta" },
    messages: [{ senderType: "VERIFIER", body: params.body?.message, createdAt: params.nowIso }],
  };
}
