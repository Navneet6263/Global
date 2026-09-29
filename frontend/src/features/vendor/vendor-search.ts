import { z } from "zod";

export const vendorRequestsSearch = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  search: z.string().trim().min(1).max(120).optional().catch(undefined),
  requestId: z.string().uuid().optional().catch(undefined),
});
export type VendorRequestsSearch = z.infer<typeof vendorRequestsSearch>;
