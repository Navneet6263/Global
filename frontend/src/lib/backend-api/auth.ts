import { apiRequest, clearSessionHint, resetApiSession } from "./client";

export type Session = {
  id: string;
  tenantId: string;
  tenantName: string;
  branchId?: string;
  branchName?: string;
  clientId?: string;
  clientName?: string;
  /** Client users: ONBOARDING until Operations approves a self sign-up company. */
  clientStatus?: string;
  /** Platform Admin oversight: may view and escalate, never change data. */
  viewOnly?: boolean;
  /** SPOC-RM only: its assigned client workspaces. */
  clientScope?: Array<{ id: string; name: string }>;
  /** Data Entry and Verifier users: their department teams (LEAD = Team Leader). */
  departments?: Array<{
    id: string;
    code: string;
    name: string;
    kind: "DATA_ENTRY" | "VERIFICATION";
    role: "LEAD" | "MEMBER";
  }>;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  /** Tenant switch: branch (office) scoping. */
  branchScoping?: boolean;
  /** Set at sign-in when the password passed the 90-day limit. */
  passwordExpired?: boolean;
  roles: string[];
  permissions: string[];
};

export type ActiveSession = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  locationLabel?: string | null;
  deviceName?: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export type ActiveSessionsResponse = {
  items: ActiveSession[];
  passwordChangedAt: string;
};

export function getSession() {
  return apiRequest<Session>("/auth/me");
}

export function login(input: { tenantCode: string; email: string; password: string }) {
  resetApiSession();
  return apiRequest<{ authenticated: true; session: Session }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout() {
  resetApiSession();
  clearSessionHint();
  return apiRequest<{ authenticated: false }>("/auth/logout", { method: "POST" }, false);
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ changed: true }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listActiveSessions() {
  return apiRequest<ActiveSessionsResponse>("/auth/sessions");
}

export function revokeActiveSession(sessionId: string) {
  return apiRequest<{ revoked: number; current: boolean }>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function revokeOtherSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/others", { method: "DELETE" });
}

export function renameActiveSession(sessionId: string, name: string) {
  return apiRequest<{ id: string; name: string }>(`/auth/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export type SecurityEvent = {
  id: string;
  action: string;
  ipAddress?: string | null;
  locationLabel?: string | null;
  afterJson?: string | null;
  createdAt: string;
  risk: "NORMAL" | "ATTENTION";
};

export function listSecurityEvents(input: { cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 8));
  return apiRequest<{
    items: SecurityEvent[];
    nextCursor: string | null;
    summary: { total: number; attention: number };
  }>(`/auth/security-events?${query.toString()}`);
}

export type SignupSettings = {
  enabled: boolean;
  tenantCode: string;
  passwordRequirements: string;
};

export type SignupChallenge = {
  signupId: string;
  /** Masked, e.g. "ri**@acme.in". */
  email: string;
  expiresAt: string;
  resendAfterSeconds: number;
};

export function getSignupSettings() {
  return apiRequest<SignupSettings>("/auth/signup/settings", {}, false);
}

export function startSignup(input: {
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  password: string;
  acceptTerms: boolean;
}) {
  return apiRequest<SignupChallenge>(
    "/auth/signup",
    { method: "POST", body: JSON.stringify(input) },
    false,
  );
}

export function resendSignupCode(signupId: string) {
  return apiRequest<SignupChallenge>(
    "/auth/signup/resend",
    { method: "POST", body: JSON.stringify({ signupId }) },
    false,
  );
}

export function verifySignup(input: { signupId: string; otp: string }) {
  resetApiSession();
  return apiRequest<{ authenticated: true; session: Session }>(
    "/auth/signup/verify",
    { method: "POST", body: JSON.stringify(input) },
    false,
  );
}
