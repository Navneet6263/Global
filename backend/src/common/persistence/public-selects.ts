export const clientPublicSelect = {
  publicId: true,
  code: true,
  legalName: true,
  displayName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  status: true,
  slaHours: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const subjectPublicSelect = {
  publicId: true,
  fullName: true,
  email: true,
  phone: true,
  employeeCode: true,
  piiCiphertext: true,
} as const;

export const checkPublicSelect = {
  publicId: true,
  type: true,
  status: true,
  result: true,
  riskLevel: true,
  dueAt: true,
  completedAt: true,
  sourceSummary: true,
  version: true,
} as const;
