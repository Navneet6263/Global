import { apiRequest } from "@/lib/backend-api/client";
import type { VendorLogPage } from "./vendor-log-model";

export const VENDOR_LOG_PAGE_SIZE = 20;

/** The caller's Vendor Logs; the server scopes them to its account or delegated requests. */
export function listVendorLogs(
  query: { cursor?: string; requestId?: string },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ limit: String(VENDOR_LOG_PAGE_SIZE) });
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.requestId) params.set("requestId", query.requestId);
  return apiRequest<VendorLogPage>(`/vendor/logs?${params.toString()}`, { signal });
}
