export type ClientStatus = "active" | "suspended" | "onboarding";

export interface ClientContact {
  id: string;
  name: string;
  designation: string;
  email: string;
  mobile: string;
  isPrimary: boolean;
}

export interface ClientUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
}

export interface ClientBilling {
  invoicedThisQuarter: number;
  outstanding: number;
  paymentTermsDays: number;
  lastPaymentAt: string | null;
}

export interface ClientPackage {
  id: string;
  name: string;
  checks: number;
  unitPrice: number;
  slaDays: number;
}

export interface ClientAuditEntry {
  id: string;
  actor: string;
  action: string;
  at: string;
}

export interface ClientOrganisation {
  id: string;
  name: string;
  industry: string;
  city: string;
  status: ClientStatus;
  slaCommitmentDays: number;
  slaAttainment: number;
  caseVolumeMtd: number;
  caseVolumeTotal: number;
  successRate: number;
  outstandingActions: number;
  primaryContact: string;
  lastActivityAt: string;
  onboardedAt: string;
  activeCases: number;
  contacts: readonly ClientContact[];
  billing: ClientBilling;
  users: readonly ClientUserSummary[];
  packages: readonly ClientPackage[];
  audit: readonly ClientAuditEntry[];
}

export interface ClientQuery {
  search?: string;
  status?: ClientStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface ClientDraft {
  name: string;
  industry: string;
  city: string;
  slaCommitmentDays: number;
  primaryContactName: string;
  primaryContactEmail: string;
}
