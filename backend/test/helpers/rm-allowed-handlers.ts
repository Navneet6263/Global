/**
 * Outside /spoc, the responsible RM may use exactly these handlers: the role-gated v2
 * workflow actions (each re-checks case/client ownership) and read-only case evidence.
 */
export const RM_ALLOWED_HANDLERS = new Set([
  "BulkIntakeController",
  "BulkIntakeController.clients",
  "BulkIntakeController.catalog",
  "BulkIntakeController.constructor",
  "BulkIntakeController.create",
  "BulkIntakeController.clientScope",
  "BulkIntakeController.assertClient",
  // The standard colour matrix and the proof on the RM's own cases (final review).
  "WorkflowController.colourMatrix",
  "CheckEvidenceController",
  "CheckEvidenceController.constructor",
  "CheckEvidenceController.list",
  "CheckEvidenceController.upload",
  "CheckEvidenceController.caption",
  "CheckEvidenceController.remove",
  "CheckEvidenceController.file",
  // Draft report preview (client copy) and report header details on the RM's cases.
  "ReportPreviewController",
  "ReportPreviewController.constructor",
  "ReportPreviewController.reportPreview",
  "ReportPreviewController.reportView",
  "ReportPreviewController.reportDetails",
  "ReportPreviewController.updateReportDetails",
  // The RM rebuilds its case's approved report PDF (audited, reason required) and
  // downloads the released PDF (same release rules as the client).
  "ReportPreviewController.regenerateReport",
  "ReportPreviewController.releasedReportPdf",
  "WorkflowController.listDepartments",
  "WorkflowController.rmQueue",
  "WorkflowController.assignDataEntry",
  "WorkflowBulkController",
  "WorkflowBulkController.constructor",
  "WorkflowBulkController.bulkAssignDataEntry",
  "WorkflowController.sendBack",
  "WorkflowController.routingPlan",
  "WorkflowController.route",
  "WorkflowController.finalReviewOverview",
  "WorkflowController.decideFinalReview",
  "WorkflowController.stopCase",
  "WorkflowController.resumeCase",
  "CasesController.get",
  "ClarificationsController.list",
  // The RM raises insufficiency and collaborates on L1/L2 clarifications for mapped clients.
  "ClarificationsController.raiseAsRm",
  "ClarificationsController.rmL1Queue",
  "ClarificationsController.rmL2Queue",
  "ClarificationsController.rmHandoff",
  "ClarificationsController.rmResolve",
  // My clients: the company profile and its Client Admin password reset.
  "RmClientProfileController",
  "RmClientProfileController.constructor",
  "RmClientProfileController.profile",
  "RmClientProfileController.resetClientAdminPassword",
  "DocumentsController.download",
  "DocumentsController.preview",
  // Self sign-up onboarding: the RM sees its companies and may message the client;
  // review, packages, approval and rejection are Operations Manager only (service check).
  "OpsOnboardingController",
  "OpsOnboardingController.constructor",
  // Client discounts: an RM sees and sets its own clients' discount, capped by the
  // package limit Operations sets (service check).
  // Read-only sidebar counts of the RM's own cases (service branch for SPOC_RM).
  "DashboardsController.navigation",
  // Read-only check-wise initiation form definitions.
  "WorkflowController.initiationForms",
  "ClientPricingController",
  "ClientPricingController.constructor",
  // Monthly billing: the RM sees its companies' dues and sends a payment reminder
  // (service limits it to the RM's own companies; audited).
  "RmPaymentsController",
  "RmPaymentsController.constructor",
  "RmPaymentsController.list",
  "RmPaymentsController.remind",
  // RM finance on its own companies: record a payment received and download the
  // invoice (service checks the company is the RM's; audited, Finance is notified),
  // and the company's preset MIS (same check; exports audited).
  "RmPaymentsController.recordPayment",
  "RmPaymentsController.invoicePdf",
  "RmClientMisController",
  "RmClientMisController.constructor",
  "RmClientMisController.clients",
  "RmClientMisController.mis",
  "RmClientMisController.misExport",
  // Vendor check work: an RM sends its own cases' checks to a vendor and reviews the
  // result (service checks case ownership; audited).
  "VendorChecksController",
  "VendorChecksController.constructor",
  "VendorChecksController.forCheck",
  "VendorChecksController.assign",
  "VendorChecksController.review",
  "VendorChecksController.cancel",
  "VendorChecksController.board",
  "VendorChecksController.export",
  "VendorChecksController.evidence",
]);
