import { z } from "zod";

const text = z.string().trim().min(1).max(120).optional().catch(undefined);
const uuid = z.string().uuid().optional().catch(undefined);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const page = z.coerce.number().int().min(1).optional().catch(undefined);
const priority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().catch(undefined);
const bucket = z
  .enum(["pending", "inProgress", "completed", "overdue", "exceptions"])
  .optional()
  .catch(undefined);

export const spocCategorySchema = z.enum([
  "overdue",
  "sla_approaching",
  "no_ops_owner",
  "checks_unassigned",
  "blocked_tasks",
  "qa_rework",
  "non_clear_results",
  "client_clarifications",
  "rejected_documents",
  "field_exception_review",
  "outside_geofence",
  "report_failed",
  "followup_overdue",
  "invoice_overdue",
  "credit_hold",
]);

/** Global monitor filters shared by the overview and the records page. */
const scope = { clientId: uuid, branchId: uuid, priority, from: day, to: day };

export const spocOverviewSearch = z.object({
  ...scope,
  category: spocCategorySchema.optional().catch(undefined),
  page,
  caseId: uuid,
});
export type SpocOverviewSearch = z.infer<typeof spocOverviewSearch>;

export const spocRecordsSearch = z.object({
  ...scope,
  domain: z
    .enum(["cases", "tasks", "qa", "visits", "opportunities", "invoices"])
    .optional()
    .catch(undefined),
  page,
  search: text,
  status: z
    .string()
    .regex(/^[A-Z_]{2,40}$/)
    .optional()
    .catch(undefined),
  bucket,
  bucketRole: z.enum(["OPS_MANAGER", "CLIENT_ADMIN"]).optional().catch(undefined),
  holderRole: z
    .enum(["CLIENT_ADMIN", "VERIFIER", "QA_REVIEWER", "OPS_MANAGER", "FINANCE_MANAGER", "NONE"])
    .optional()
    .catch(undefined),
  sla: z.enum(["overdue", "approaching", "healthy", "dueToday"]).optional().catch(undefined),
  view: z.enum(["awaiting", "claimed", "rework", "decided"]).optional().catch(undefined),
  followUp: z.enum(["overdue", "none"]).optional().catch(undefined),
  ownerId: uuid,
  assigneeId: uuid,
  activeOnly: z.boolean().optional().catch(undefined),
  caseId: uuid,
});
export type SpocRecordsSearch = z.infer<typeof spocRecordsSearch>;

export const spocClientsSearch = z.object({
  page,
  search: text,
  status: z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED"]).optional().catch(undefined),
});
export type SpocClientsSearch = z.infer<typeof spocClientsSearch>;

/** Vendors page: client list, or one client's documents when clientId is set. */
export const spocVendorsSearch = z.object({
  clientId: uuid,
  documentId: uuid,
  page,
  search: text,
  vendorStatus: z
    .enum(["NOT_ASSIGNED", "PENDING", "APPROVED", "REJECTED"])
    .optional()
    .catch(undefined),
});
export type SpocVendorsSearch = z.infer<typeof spocVendorsSearch>;
