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
  /** The latest report of an APPROVED attempt of an assigned client. */
  report: "assignments/:assignmentId/report",
} as const;

export const VENDOR_REQUEST_ROUTES = {
  /** Vendor workspace: VENDOR with vendor:review, own requests only. */
  base: "vendor/requests",
  request: ":requestId",
  preview: ":requestId/preview",
  decision: ":requestId/decision",
  /** Main Vendor only (checked in the service): hand to a team user, or remind them. */
  delegate: ":requestId/delegate",
  remind: ":requestId/remind",
  /** Main Vendor or the delegated team user; APPROVED requests only. */
  report: ":requestId/report",
} as const;

export const VENDOR_LOG_ROUTES = {
  /** Vendor account activity from the audit trail, scoped to the caller. */
  base: "vendor/logs",
} as const;

export const VENDOR_TEAM_ROUTES = {
  /** Vendor workspace team page: any vendor reads; only the Main Vendor manages. */
  base: "vendor/team",
  users: "users",
  userStatus: "users/:userId/status",
  userPassword: "users/:userId/reset-password",
} as const;
