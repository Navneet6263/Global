import { z } from "zod";

const page = z.coerce.number().int().min(1).optional().catch(undefined);
const text = z.string().trim().min(1).max(120).optional().catch(undefined);
const uuid = z.string().uuid().optional().catch(undefined);

export const supportClientsSearch = z.object({ page, search: text });
export type SupportClientsSearch = z.infer<typeof supportClientsSearch>;

export const supportEmployeesSearch = z.object({
  page,
  search: text,
  clientId: uuid,
  state: z.enum(["PENDING", "COMPLETED", "EXCEPTION", "CANCELLED"]).optional().catch(undefined),
  caseId: uuid,
});
export type SupportEmployeesSearch = z.infer<typeof supportEmployeesSearch>;

export const supportRequestsSearch = z.object({
  page,
  search: text,
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ALL"]).optional().catch(undefined),
  requesterType: z.enum(["CANDIDATE", "CLIENT_ADMIN"]).optional().catch(undefined),
  mine: z.boolean().optional().catch(undefined),
  requestId: uuid,
});
export type SupportRequestsSearch = z.infer<typeof supportRequestsSearch>;
