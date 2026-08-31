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

export interface ClientOrganisation {
  id: string;
  code: string;
  name: string;
  legalName: string;
  status: ClientStatus;
  slaCommitmentDays: number;
  slaAttainment: number | null;
  caseVolumeTotal: number;
  outstandingActions: number;
  primaryContact: string;
  lastActivityAt: string;
  onboardedAt: string;
  activeCases: number;
  contacts: readonly ClientContact[];
  users: readonly ClientUserSummary[];
}

export interface ClientQuery {
  search?: string;
  status?: ClientStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface ClientDraft {
  name: string;
  slaCommitmentDays: number;
  primaryContactName: string;
  primaryContactEmail: string;
}
