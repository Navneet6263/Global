import { Permission } from "../src/common/auth/permissions";

/** System roles and their permissions, seeded for every tenant. */
export const rolePermissions: Record<string, string[]> = {
  PLATFORM_ADMIN: ["*"],
  OPS_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.CaseRead,
    Permission.CaseCreate,
    Permission.CaseTransition,
    Permission.ConsentManage,
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.TaskRead,
    Permission.TaskWrite,
    Permission.ClarificationRead,
    Permission.ClarificationWrite,
    Permission.ReportRead,
    Permission.FieldVisitRead,
    Permission.FieldVisitWrite,
    Permission.FieldEvidenceRead,
    Permission.UserRead,
    Permission.NotificationRead,
  ],
  VERIFIER: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.DocumentRead,
    Permission.TaskRead,
    Permission.TaskWrite,
    Permission.ClarificationRead,
    Permission.ClarificationWrite,
    Permission.NotificationRead,
  ],
  QA_REVIEWER: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.DocumentRead,
    Permission.ClarificationRead,
    Permission.QaReview,
    Permission.ReportRead,
    Permission.ReportGenerate,
    Permission.FieldEvidenceRead,
    Permission.NotificationRead,
  ],
  CLIENT_ADMIN: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.CaseCreate,
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.ClarificationRead,
    Permission.ReportRead,
    Permission.NotificationRead,
    Permission.SupportRequest,
  ],
  FIELD_EXECUTIVE: [
    Permission.CaseRead,
    Permission.FieldVisitRead,
    Permission.FieldVisitWrite,
    Permission.FieldEvidenceRead,
    Permission.NotificationRead,
  ],
  SALES_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.ClientWrite,
    Permission.CrmRead,
    Permission.CrmWrite,
    Permission.NotificationRead,
  ],
  FINANCE_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.FinanceRead,
    Permission.FinanceWrite,
    Permission.NotificationRead,
  ],
  // Central monitor. Data comes only from the role-gated /spoc module; the one write
  // is vendor assignment (/spoc/vendors). Never grant other write permissions
  // (PATCH /cases/:id/status is permission-gated only).
  SPOC_RM: [
    Permission.DashboardRead,
    Permission.NotificationRead,
    Permission.VendorAssign,
  ],
  // External vendor: only the document requests assigned to it (/vendor/requests).
  VENDOR: [Permission.VendorReview, Permission.NotificationRead],
  // Support desk: read-only visibility (/support) and the support-request inbox.
  SUPPORT_AGENT: [
    Permission.SupportRead,
    Permission.SupportHandle,
    Permission.NotificationRead,
  ],
};
