/**
 * Every vendor-workflow endpoint in one place. The controllers bind their handlers
 * to these paths (NestJS registers routes through the controller decorators).
 */
export const SPOC_VENDOR_ROUTES = {
  /** SPOC-RM Vendors page: SPOC_RM / PLATFORM_ADMIN with vendor:assign. */
  base: "spoc/vendors",
  clients: "clients",
  clientDocuments: "clients/:clientId/documents",
  document: "documents/:documentId",
  preview: "documents/:documentId/preview",
  vendors: "vendors",
  assign: "documents/:documentId/assignments",
  reassign: "assignments/:assignmentId/reassign",
  reupload: "documents/:documentId/reupload-request",
} as const;

export const VENDOR_REQUEST_ROUTES = {
  /** Vendor workspace: VENDOR with vendor:review, own requests only. */
  base: "vendor/requests",
  request: ":requestId",
  preview: ":requestId/preview",
  decision: ":requestId/decision",
} as const;
