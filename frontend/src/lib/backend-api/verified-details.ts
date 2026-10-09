import { apiRequest } from "./client";
import type { InitiationForm } from "./workflow";

export type DetailEntry = Record<string, string>;

export interface VerifiedDetails {
  checkId: string;
  type: string;
  /** Check-specific wording, e.g. "Negative", "Verified — no records found". */
  statusLabel: string;
  lhs: { form: InitiationForm | null; entries: DetailEntry[] };
  rhs: { form: InitiationForm; entries: DetailEntry[]; verifiedAt: string | null };
}

export const getVerifiedDetails = (checkId: string) =>
  apiRequest<VerifiedDetails>(`/checks/${checkId}/verified-details`);

export const saveVerifiedDetails = (checkId: string, entries: DetailEntry[]) =>
  apiRequest<{ checkId: string; verifiedAt: string; entries: DetailEntry[] }>(
    `/checks/${checkId}/verified-details`,
    { method: "PUT", body: JSON.stringify({ entries }) },
  );
