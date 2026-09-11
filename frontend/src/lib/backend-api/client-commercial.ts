import { apiRequest } from "./client";

export interface ClientRate {
  servicePackageId: string;
  name?: string;
  unitPrice: number;
  taxRate: number;
  tatHours: number | null;
  active: boolean;
}
export interface AgreementDraft {
  type: "AGREEMENT" | "DPA" | "CONFIDENTIALITY" | "PROPOSAL";
  reference: string;
  signedAt?: string;
  expiresAt?: string;
}
export interface CommercialSettings {
  id: string;
  version: number;
  gstin: string | null;
  billingTerms: string | null;
  billingAddress: string | null;
  packages: ClientRate[];
  agreements: Array<AgreementDraft & { id: string }>;
  catalog: Array<{ id: string; name: string; price: number | null; tatHours: number }>;
}
export const getClientCommercial = (clientId: string) =>
  apiRequest<CommercialSettings>(`/clients/${clientId}/commercial`);
export function updateClientCommercial(
  clientId: string,
  input: {
    version: number;
    gstin: string;
    billingTerms: string;
    billingAddress: string;
    packages: Array<Omit<ClientRate, "name" | "tatHours"> & { tatHours?: number }>;
    agreements: AgreementDraft[];
  },
) {
  return apiRequest<CommercialSettings>(`/clients/${clientId}/commercial`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
