/**
 * Every support endpoint in one place. The controllers bind their handlers to these
 * paths (NestJS registers routes through the controller decorators).
 */
export const SUPPORT_ROUTES = {
  /** Support Agent desk: SUPPORT_AGENT / PLATFORM_ADMIN. */
  desk: "support",
  summary: "summary",
  clients: "clients",
  employees: "employees",
  employee: "employees/:caseId",
  requests: "requests",
  request: "requests/:requestId",
  /** Client Admin: raise and follow its own requests. */
  clientRequests: "support-requests",
  /** Candidate link: public, authorised by the portal token. */
  candidateRequests: "public/candidate-access/:accessId/support-requests",
} as const;
