import { apiRequest } from "@/lib/backend-api/client";
import type {
  MySupportRequest,
  RaiseSupportRequestInput,
  SupportClientRow,
  SupportEmployeeDetail,
  SupportEmployeeQuery,
  SupportEmployeeRow,
  SupportPage,
  SupportRequestQuery,
  SupportRequestRow,
  SupportSummary,
  UpdateSupportRequestInput,
} from "./support-contracts";

const id = (value: string) => encodeURIComponent(value);

function toQuery(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Support Agent desk (/support). Scope and allowed actions are decided by the server. */
export const supportApi = {
  summary: (signal?: AbortSignal) => apiRequest<SupportSummary>("/support/summary", { signal }),
  clients: (query: { page: number; pageSize: number; search?: string }, signal?: AbortSignal) =>
    apiRequest<SupportPage<SupportClientRow>>(`/support/clients${toQuery(query)}`, { signal }),
  employees: (query: SupportEmployeeQuery, signal?: AbortSignal) =>
    apiRequest<SupportPage<SupportEmployeeRow>>(`/support/employees${toQuery(query)}`, {
      signal,
    }),
  employee: (caseId: string, signal?: AbortSignal) =>
    apiRequest<SupportEmployeeDetail>(`/support/employees/${id(caseId)}`, { signal }),
  requests: (query: SupportRequestQuery, signal?: AbortSignal) =>
    apiRequest<SupportPage<SupportRequestRow>>(`/support/requests${toQuery(query)}`, {
      signal,
    }),
  request: (requestId: string, signal?: AbortSignal) =>
    apiRequest<SupportRequestRow>(`/support/requests/${id(requestId)}`, { signal }),
  update: (input: UpdateSupportRequestInput) =>
    apiRequest<SupportRequestRow>(`/support/requests/${id(input.requestId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: input.status,
        version: input.version,
        note: input.note || undefined,
      }),
    }),
};

/** Client Admin (/support-requests): raise a request and follow its own requests. */
export const clientSupportApi = {
  mine: (page: number, signal?: AbortSignal) =>
    apiRequest<SupportPage<MySupportRequest>>(
      `/support-requests${toQuery({ page, pageSize: 10 })}`,
      {
        signal,
      },
    ),
  raise: (input: RaiseSupportRequestInput) =>
    apiRequest<MySupportRequest>("/support-requests", {
      method: "POST",
      body: JSON.stringify({
        subject: input.subject,
        message: input.message,
        caseNumber: input.caseNumber || undefined,
      }),
    }),
};
