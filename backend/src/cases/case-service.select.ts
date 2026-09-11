export const caseServiceSummarySelect = {
  publicId: true,
  serviceFamily: true,
  tatHours: true,
  requiredDocumentsJson: true,
  servicePackage: { select: { publicId: true, code: true, name: true } },
  checks: {
    select: {
      publicId: true,
      type: true,
      status: true,
      result: true,
      dueAt: true,
    },
  },
} as const;
