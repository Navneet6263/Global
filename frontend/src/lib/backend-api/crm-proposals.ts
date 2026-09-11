import { apiDownload, apiRequest, saveBlob } from "./client";
export interface ProposalLine {
  packageId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}
export interface Proposal {
  id: string;
  revision: number;
  version: number;
  status: string;
  validUntil: string;
  isAuthor: boolean;
  approvedAt: string | null;
  snapshot: {
    company: string;
    preparedBy: string;
    preparedAt: string;
    terms: string;
    totalPaise: string;
    currency: string;
    lines: Array<ProposalLine & { name: string; serviceFamily: string; tatHours: number }>;
  };
}
export interface ProposalCatalog {
  id: string;
  name: string;
  price: number | null;
  tatHours: number;
  serviceFamily: string;
}
export function listProposals(id: string) {
  return apiRequest<{
    items: Proposal[];
    catalog: ProposalCatalog[];
    opportunityVersion: number;
    stage: string;
  }>(`/crm/opportunities/${id}/proposals`);
}
export function createProposal(
  id: string,
  input: { opportunityVersion: number; validUntil: string; terms: string; lines: ProposalLine[] },
) {
  return apiRequest(`/crm/opportunities/${id}/proposals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function decideProposal(
  id: string,
  proposal: string,
  input: { version: number; status: string; evidence: string },
) {
  return apiRequest(`/crm/opportunities/${id}/proposals/${proposal}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
export async function downloadProposal(id: string, proposal: Proposal) {
  saveBlob(
    await apiDownload(`/crm/opportunities/${id}/proposals/${proposal.id}/pdf`),
    `proposal-r${proposal.revision}.pdf`,
  );
}
export interface CrmSequence {
  version: number;
  stage: string;
  hasOwner: boolean;
  nextFollowUpAt: string | null;
  followUpSequenceStep: number | null;
  followUpSequenceStartedAt: string | null;
}
export function getCrmSequence(id: string) {
  return apiRequest<CrmSequence>(`/crm/opportunities/${id}/follow-up-sequence`);
}
export function setCrmSequence(id: string, version: number, enabled: boolean) {
  return apiRequest(`/crm/opportunities/${id}/follow-up-sequence`, {
    method: "POST",
    body: JSON.stringify({ version, enabled }),
  });
}
