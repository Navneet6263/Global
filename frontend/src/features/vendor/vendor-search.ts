import { z } from "zod";

/** Vendor request lists and the overview: status comes from the sidebar route. */
export const vendorRequestsSearch = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  search: z.string().trim().min(1).max(120).optional().catch(undefined),
  requestId: z.string().uuid().optional().catch(undefined),
});
export type VendorRequestsSearch = z.infer<typeof vendorRequestsSearch>;

/** Vendor Logs: optionally one request's activity only. */
export const vendorLogsSearch = z.object({
  requestId: z.string().uuid().optional().catch(undefined),
});
export type VendorLogsSearch = z.infer<typeof vendorLogsSearch>;
