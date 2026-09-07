import type { Prisma } from "../generated/prisma/client";

export const qaDetailSelect = {
  publicId: true,
  caseNumber: true,
  priority: true,
  dueAt: true,
  version: true,
  createdAt: true,
  qaClaimedAt: true,
  qaReviewer: { select: { publicId: true, displayName: true } },
  subject: { select: { publicId: true, fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  checks: {
    select: {
      publicId: true,
      type: true,
      result: true,
      riskLevel: true,
      status: true,
      sourceSummary: true,
      updatedAt: true,
      findings: {
        select: {
          publicId: true,
          kind: true,
          severity: true,
          title: true,
          description: true,
          source: true,
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        where: { status: "COMPLETED" },
        select: {
          completedAt: true,
          completedBy: {
            select: { publicId: true, displayName: true },
          },
        },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  },
  documents: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      versions: {
        select: {
          originalName: true,
          contentType: true,
          sha256: true,
          malwareState: true,
          createdAt: true,
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  },
  fieldVisits: {
    select: {
      publicId: true,
      status: true,
      address: true,
      distanceMeters: true,
      capturedAt: true,
      evidence: {
        select: {
          publicId: true,
          type: true,
          sha256: true,
          capturedAt: true,
        },
        orderBy: { capturedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.VerificationCaseSelect;
