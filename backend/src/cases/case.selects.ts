import {
  checkPublicSelect,
  subjectPublicSelect,
} from "../common/persistence/public-selects";

export const caseListSelect = {
  publicId: true,
  caseNumber: true,
  externalRef: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  riskLevel: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: subjectPublicSelect },
  client: { select: { publicId: true, code: true, displayName: true } },
  checks: { select: checkPublicSelect, orderBy: { createdAt: "asc" as const } },
} as const;

export const caseDetailSelect = {
  ...caseListSelect,
  checks: {
    select: {
      ...checkPublicSelect,
      findings: {
        select: {
          publicId: true,
          kind: true,
          severity: true,
          title: true,
          description: true,
          source: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
      tasks: {
        select: {
          publicId: true,
          status: true,
          instructions: true,
          dueAt: true,
          version: true,
          assignee: {
            select: { publicId: true, displayName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  statusHistory: {
    select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
  consents: {
    select: {
      publicId: true,
      status: true,
      purpose: true,
      noticeVersion: true,
      acceptedAt: true,
      withdrawnAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  documents: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      expiresAt: true,
      versions: {
        select: {
          version: true,
          originalName: true,
          contentType: true,
          sizeBytes: true,
          sha256: true,
          malwareState: true,
          createdAt: true,
        },
        orderBy: { version: "desc" as const },
      },
    },
  },
  clarifications: {
    select: {
      publicId: true,
      status: true,
      subject: true,
      dueAt: true,
      resolvedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  qaReviews: {
    select: {
      publicId: true,
      decision: true,
      notes: true,
      checklistJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  reports: {
    select: {
      publicId: true,
      status: true,
      currentVersion: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  fieldVisits: {
    select: {
      publicId: true,
      status: true,
      version: true,
      address: true,
      geofenceMeters: true,
      distanceMeters: true,
      capturedAt: true,
      completedAt: true,
      checkedInAt: true,
      checkInAccuracy: true,
      assignee: {
        select: { publicId: true, displayName: true, email: true },
      },
      evidence: {
        select: {
          publicId: true,
          type: true,
          contentType: true,
          sha256: true,
          capturedAt: true,
          createdAt: true,
        },
        orderBy: { capturedAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;
